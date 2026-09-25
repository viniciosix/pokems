#!/usr/bin/env python3
import argparse
import datetime
import time
from pathlib import Path

import requests
import yaml

from device import AdbDevice
from route import generate_snake
from classifier import PokemonClassifier

HERE = Path(__file__).resolve().parent

def crop_ratio(img, rect):
    x1, y1, x2, y2 = rect
    w, h = img.size
    return img.crop((int(x1*w), int(y1*h), int(x2*w), int(y2*h)))

def post(cfg, path, payload):
    url = cfg['server']['url'].rstrip('/') + path
    headers = {'Authorization': 'Bearer ' + cfg['server']['token']}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        print('[server]', exc)
        return None

def scan_nearby(dev, cfg, clf, lat, lon, point_index):
    ui = cfg['ui']
    ccfg = cfg['classifier']
    dev.tap_ratio(float(ui['nearby_button_x']), float(ui['nearby_button_y']))
    time.sleep(float(ui.get('open_wait_seconds', 2)))
    shot = dev.screenshot()
    ts = int(time.time())
    capdir = HERE / 'captures'
    capdir.mkdir(exist_ok=True)
    detections = []

    for i, cell in enumerate(ui['cells']):
        card = crop_ratio(shot, cell)
        pkmn = crop_ratio(card, ccfg.get('pokemon_crop', [0,0,1,1]))
        try:
            result = clf.classify(pkmn)
        except Exception as exc:
            print('[classifier]', exc)
            continue

        if result and result.get('species'):
            detections.append({
                'species': result['species'],
                'confidence': result['confidence'],
                'lat': lat,
                'lon': lon,
                'accuracy_m': max(80, float(cfg['scan']['spacing_m']) / 2),
                'seen_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'source': 'alt-nearby',
            })
            print(f"  ✓ célula {i+1}: {result['species']} {result['confidence']:.0%}")
        elif ccfg.get('save_unknowns', True):
            score = result.get('confidence', 0) if result else 0
            cand = result.get('candidate', 'unknown') if result else 'unknown'
            pkmn.save(capdir / f'unknown_{point_index:05d}_{i}_{cand}_{score:.2f}_{ts}.jpg')

    if ui.get('close_with_back', True):
        dev.back()
        time.sleep(.5)

    return detections

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', default=str(HERE/'config.yaml'))
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    cfg = yaml.safe_load(open(args.config, 'r', encoding='utf8'))
    dev = AdbDevice(cfg['device'].get('adb', 'adb'), cfg['device'].get('serial', ''))
    s = cfg['scan']

    pts = generate_snake(
        float(s['north']), float(s['south']),
        float(s['west']), float(s['east']),
        float(s['spacing_m']),
    )

    if int(s.get('max_points', 0)) > 0:
        pts = pts[:int(s['max_points'])]

    print(f'PokeMS: {len(pts)} pontos, espaçamento {s["spacing_m"]} m')
    clf = None if args.dry_run else PokemonClassifier(
        cfg['classifier']['model'],
        float(cfg['classifier']['confidence']),
    )

    cycle = 0
    while True:
        cycle += 1
        for idx, (lat, lon) in enumerate(pts, 1):
            print(f'[{idx}/{len(pts)}] {lat:.6f},{lon:.6f}')

            if args.dry_run:
                time.sleep(.02)
                continue

            driver = cfg['device'].get('location_driver', 'mock_app')
            if driver == 'emulator':
                dev.set_location_emulator(lat, lon)
            else:
                dev.set_location_mock_app(cfg['device']['mock_action'], lat, lon)

            post(cfg, '/api/status', {
                'mode': 'scanning',
                'index': idx,
                'total': len(pts),
                'cycle': cycle,
                'lat': lat,
                'lon': lon,
            })

            time.sleep(float(s.get('dwell_seconds', 10)))
            found = scan_nearby(dev, cfg, clf, lat, lon, idx)
            if found:
                post(cfg, '/api/detections', found)

        if not args.dry_run:
            post(cfg, '/api/status', {
                'mode': 'cycle-complete',
                'index': len(pts),
                'total': len(pts),
                'cycle': cycle,
            })

        if not s.get('loop', True):
            break

if __name__ == '__main__':
    main()
