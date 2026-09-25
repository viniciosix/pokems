#!/usr/bin/env python3
from pathlib import Path
from device import AdbDevice
import argparse

ap = argparse.ArgumentParser()
ap.add_argument('--adb', default='adb')
ap.add_argument('--serial', default='')
args = ap.parse_args()

img = AdbDevice(args.adb, args.serial).screenshot()
out = Path(__file__).with_name('calibration.png')
img.save(out)
print(out)
