# Pinch me, I'm zooming: gestures in the DOM

Two-finger gestures are commonly used with touchscreens and modern trackpads to manipulate on-screen elements like they were physical objects.

A two-finger gesture, when paired with a coordinate system, encodes an exact combination of translation, uniform scaling, and rotation. To maintain the illusion of direct manipulation, this affine transform must map naturally to the movement of the fingers. 

For touchscreens, a simple rule-of-thumb is to have the parts of the on-screen element the user has touched remain — at least in an unconstrained transform — underneath the fingertips. For the purpose of two-finger gestures, the trackpad can be treated as a surrogate touchscreen, and the same rule applied.

How the two fingers move in relation to each other encodes, by itself, the scale and rotation:

```
dx = finger1.x - finger2.x;
dy = finger1.y - finger2.y;
distance = Math.sqrt(dx * dx + dy * dy);
angle = Math.atan2(dy, dy);

scale = distance / initial_distance;
rotation = angle - initial_angle;
cx = (finger1.x + finger2.x) / 2;
cy = (finger1.y + finger2.y) / 2;
```

On the other hand, translation — that is the movement, in tandem, of the two fingers, as reflected in the difference between the initial and current values of the _center of the gesture_ `(cx, cy)` — needs a frame of reference (a coordinate system) to establish its magnitude. Another way to think about this is that scale is always an unitless value, rotation is in _radians_, indifferent to the coordinate system; the translation's units are dependent on the coordinate system (pixels, etc.).

Native applications on touchscreen-powered devices usually have access to [high-level APIs](https://developer.apple.com/documentation/uikit/touches_presses_and_gestures/handling_uikit_gestures) to extract the _translation_, _scale_ and _rotation_ from the user gesture. 

Are web apps as lucky? In this article, we explore the parts of the Web APIs we have at our disposal to recognize, and act upon, two-finger gestures. 

## A summary of relevant DOM events

The `WheelEvent` (`wheel`) is triggered when the user intends to scroll an element. This was originally done with the mouse's wheel (hence the name), but then applied to other pointing devices — the trackpad might have had a separate "scroll area", and later became sophisticated enough to accept multi-finger gestures.

The `WheelEvent` has specific properties, `deltaX`, `deltaY`, and `deltaZ` to encode the (potentially 3D) movement dictated by the input device, and `deltaMode` to establish the unit of measurement (pixels, lines, or pages).

As pinch gestures on trackpads became more commonplace, browser implementers started thinking of ways to support them in desktop browsers. Chrome settled on [an approach](https://bugs.chromium.org/p/chromium/issues/detail?id=289887) inspired by Internet Explorer: encode pinch gestures as `wheel` events with `event.ctrlKey` set to `true`, and `deltaY` encoding the scale. Firefox eventually [followed suit](https://bugzilla.mozilla.org/show_bug.cgi?id=1052253), and with Microsoft Edge recently switching to Chromium, we end up with a de-facto standard. 

Sometime between Chrome adding support for pinching and Firefox catching up, [Safari 9.1](https://developer.apple.com/library/archive/releasenotes/General/WhatsNewInSafari/Articles/Safari_9_1.html) introduced [their own proprietary `GestureEvent`](https://developer.apple.com/documentation/webkitjs/gestureevent) that exposes `scale` and `rotation` properties, computed by the formulas shown in the introduction. To this day, Safari (desktop and mobile) remains the only browser implementing `GestureEvent`. 

> Sidenote: At the time of writing, neither Safari nor the other browsers expose the entire affine transform for the gesture: the `translation` and `rotation` aspects are absent from `WheelEvent`, and only the latter is present in `GestureEvent`. 

On touchscreen-powered devices, we have more flexibility. While only mobile Safari supports `GestureEvent`, most mobile browsers produce `TouchEvent`s that encode movement of individual fingers in a gesture, allowing us to construct the affine transform manually.

## Putting browsers to the test

Equipped with the theoretical knowledge, let's see how things actually pan out on a variety of devices. Scrambling for hardware, I produced:

* an Apple MacBook Pro with an external Magic Trackpad, running macOS Big Sur;
* a Microsoft Surface Laptop with a touchscreen, built-in Precision Trackpad and external mouse, running Windows 10;
* an Asus notebook with a (non-precision) trackpad and external mouse, again running Windows 10;
* an iPhone running iOS 14; and,
* an iPad with a Folio keyboard, running iPadOS 14.

On these devices, I've installed recent versions of Mozilla Firefox, Google Chrome, Apple Safari, and Microsoft Edge (Chromium-based).

I've created [a test page](https://danburzo.github.io/ok-zoomer/tools/graph) that displays relevant properties of all wheel, gesture, pointer and touch events captured. Let's see at some of the results.

### macOS results

As advertised, Firefox and Chrome generally produce a `wheel` event with a `deltaY` and `ctrlKey: true`. They also produce this result when you scroll normally while holding the <kbd>Ctrl</kbd> key pressed, a combo especially familiar to Windows users of various native visual tools for zooming in and out.

This is a theoretical win — the pinch gesture is funneled on the same path as a normal scroll with a modifier key. This was, after all, the explicit intent of browser implemeters: to piggyback on a widely used way to zoom in and out of things. 

In practice, we now have two indistinguishable `wheel` events, whose `deltaY` value means two very different things — a scaling factor in the case of the pinch gesture, and an offset in the case of `Ctrl + scroll`. What was a perhaps livable situation back in the day, with the advent of inertial scrolling an honest `Ctrl + scroll` produces offsets an order of magnitude greater than a pinch gesture, resisting a simple uniform approach — either the scroll will zoom at breakneck speed or, conversely, the pinch will feel as if the object resists scaling.

There's precious little to tell the two events apart, but there's a way out: looking at whether a _physical_ <kbd>Ctrl</kbd> key is pressed. The DOM doesn't afford interrogating the state of keyboard buttons on-demand, so we must take an indirect approach: listen to the keypresses and keep track of the state manually. To do that we have to jump through some hoops, and even then it's not 100% perfect, but it gets us what we want in most cases:

```js
let is_ctrl;
window.addEventListener('keydown', e => e.key === 'Control' && (is_ctrl = true), { capture: true });
window.addEventListener('keyup', e => e.key === 'Control' && (is_ctrl = false), { capture: true });
window.addEventListener('pagehide', () => is_ctrl = false);
window.addEventListener('blur', () => is_ctrl = false);
document.addEventListener('visibilitychange', () => document.visibilityState !== 'visible' && (is_ctrl = false));
	
```

A couple of notes on the code:

* the keyboard event listeners are attached to the window on the capture phase, so that other parts of the code have fewer chances to stop the event from propagating and messing up our `is_ctrl` flag;
* some keyboard shortcuts involving the <kbd>Ctrl</kbd> key might move the focus away from the browser, so there won't be a `keyup` event to invalidate the `is_ctrl` flag once the user returns to the page. In these cases (`visibilitychange`, `pagehide`, `blur`), we invalidate the flag manually.

We'll get to the part where we figure out what `deltaY` means in both cases, but for the moment, a small win is we now have a not too horrible, and decently reliable, way to distinguish between true `Ctrl + scroll` events and pinches:

```js
el.addEventListener('wheel', e => {
  if (e.ctrlKey) {
    if (is_ctrl) {
      // True Ctrl + scroll
    } else {
      // Pinch gesture
    }
  } else {
    // Normal scroll
  }
});
```

(Astute readers will notice the code doesn't distinguish between a `Ctrl + scroll` and a `Ctrl + pinch`, but the latter is so infrequent we can shrug off it feeling a little weird if anyone stumbles upon it.)

As for Safari, it reacts to its proprietary `gesturestart`, `gesturechange`, and `gestureend` events, producing a `scale` and `rotation`. I was hoping the `clientX` and `clientY` event properties would allow us to derive the translation, but they remain constant throughout the gesture despite finger movement, so no dice.

Some default browser behaviors to deflect with `event.preventDefault()` on the relevant event:

* `Alt + wheel` in Firefox will navigate through the browser history, surely a remnant from the times of discrete steps on a mousewheel that now feels weird with inertial trackpads;
* `Cmd + wheel` in Firefox zooms in and out of the page, similarly to `Cmd +` and `Cmd -`;
* Pinching inwards in Safari will minimize the browser tab and show a tab overview screen.

### Windows results

Firefox, Chrome and Edge work like their macOS counterparts on Windows devices equipped with a Precision Trackpad.

It's older trackpads and external mice that add some accidental complexity to the mix. 

## The math bits
```
100 * Math.log(1 / testScale)
```