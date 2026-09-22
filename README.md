## gan-cube-sample

A one-page demonstration of [gan-web-bluetooth](https://github.com/mjohnson139/gan-web-bluetooth):
connecting to a GAN Smart Cube, mirroring it in 3D, timing a solve accurately,
and following its gyroscope.

This is a fork. Two things differ from
[upstream](https://github.com/afedotov/gan-cube-sample):

**It runs without a cube.** *Connect Simulated* builds a cube that isn't there,
using `gan-web-bluetooth/simulation`. Every button in the panel that appears —
turn a face, scramble, report a battery level, tumble the gyroscope — emits a
real Gen2 frame, bit-packed and AES-encrypted with a MAC-salted key, through the
real transport, the real protocol driver and the real `events$`. Nothing above
the transport is stubbed, so what you see the page do is what it does with
hardware. Try it: *Scramble*, press SPACE to arm the timer, then turn the cube
back to solved and watch the timer stop.

**It is React rather than jQuery**, which is the only way the above is
practical — the connection lifecycle, the event stream and the timer state
machine are hooks (`src/hooks/`), so the simulated and Bluetooth paths differ in
one line and share everything else.

The real Bluetooth path still needs Chrome or Edge on a desktop, and a cube.
Web Bluetooth is not available in Firefox or Safari; the *Connect* button is
disabled and says so where it is missing.

### Running it

```sh
npm install
npm run dev
```

`npm run build` type-checks and bundles; `npm run typecheck` does the former
alone.

Upstream publishes a live version of its own version of this page at
https://afedotov.github.io/gan-cube-sample/.
