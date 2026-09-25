import io
import re
import subprocess
from PIL import Image

class AdbDevice:
    def __init__(self, adb='adb', serial=''):
        self.base = [adb]
        if serial:
            self.base += ['-s', serial]

    def run(self, *args, capture=True):
        p = subprocess.run(
            self.base + list(args),
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
            check=False,
        )
        if p.returncode != 0:
            raise RuntimeError((p.stderr or b'adb failed').decode(errors='ignore'))
        return p.stdout if capture else b''

    def shell(self, *args):
        return self.run('shell', *args)

    def tap_ratio(self, x, y):
        out = self.shell('wm', 'size').decode(errors='ignore')
        m = re.search(r'(\d+)x(\d+)', out)
        if not m:
            raise RuntimeError('Não consegui ler a resolução via adb shell wm size')
        w, h = map(int, m.groups())
        self.shell('input', 'tap', str(int(w*x)), str(int(h*y)))

    def screenshot(self):
        data = self.run('exec-out', 'screencap', '-p')
        return Image.open(io.BytesIO(data)).convert('RGB')

    def back(self):
        self.shell('input', 'keyevent', '4')

    def set_location_mock_app(self, action, lat, lon, alt=520.0):
        self.shell(
            'am','broadcast','-a',action,
            '--es','lat',f'{lat:.7f}',
            '--es','lon',f'{lon:.7f}',
            '--es','alt',str(alt),
        )

    def set_location_emulator(self, lat, lon):
        self.run('emu', 'geo', 'fix', f'{lon:.7f}', f'{lat:.7f}')
