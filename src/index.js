const WHEEL_SPEEDUP = 2;
const DELTA_LINE_MULTIPLIER = 8;
const DELTA_PAGE_MULTIPLIER = 24;
const MAX_WHEEL_DELTA = 24;

function normalizeWheel(e) {
	let dx = e.deltaX;
	let dy = e.deltaY;
	if (e.shiftKey && dx === 0) {
		let tmp = dx;
		dx = dy;
		dy = tmp;
	}
	if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
		dx *= DELTA_LINE_MULTIPLIER;
		dy *= DELTA_LINE_MULTIPLIER;
	} else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		dx *= DELTA_PAGE_MULTIPLIER;
		dy *= DELTA_PAGE_MULTIPLIER;
	}
	return [limit(dx, MAX_WHEEL_DELTA), limit(dy, MAX_WHEEL_DELTA)];
}

function limit(delta, max_delta) {
	return Math.sign(delta) * Math.min(max_delta, Math.abs(delta));
}

function midpoint(touches) {
	let [t1, t2] = touches;
	return [(t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2];
}

function distance(touches) {
	let [t1, t2] = touches;
	let dx = t2.clientX - t1.clientX;
	let dy = t2.clientY - t2.clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

function angle(touches) {
	let [t1, t2] = touches;
	let dx = t2.clientX - t1.clientX;
	let dy = t2.clientY - t2.clientY;
	return (180 / Math.PI) * Math.atan2(dy, dx);
}

function clientToHTMLElementCoords(element, coords) {
	let rect = element.getBoundingClientRect();
	return {
		x: coords[0] - rect.x,
		y: coords[1] - rect.y
	};
}

function clientToSVGElementCoords(element, coords) {
	let screen_to_el = element.getScreenCTM().inverse();
	let point = element.ownerSVGElement.createSVGPoint();
	point.x = coords[0];
	point.y = coords[1];
	return point.matrixTransform(screen_to_el);
}

export default function okzoomer(element, opts) {
	function noop() {
		/* do nothing */
	}

	let options = opts || {};

	let startGesture = options.startGesture || noop;
	let doGesture = options.doGesture || noop;
	let endGesture = options.endGesture || noop;

	// TODO: we shouldn't be reusing gesture
	let gesture = false;
	let timer;

	let origin;
	if (element instanceof HTMLElement) {
		origin = clientToHTMLElementCoords;
	} else if (element instanceof SVGElement) {
		origin = clientToSVGElementCoords;
	} else {
		throw new Error('unsupported element type, expecting HTML or SVG');
	}

	document.addEventListener('wheel', function wheelListener(e) {
		e.preventDefault();
		let [, dy] = normalizeWheel(e);
		if (!gesture) {
			gesture = {
				scale: 1,
				origin: origin(element, [e.clientX, e.clientY])
			};
			startGesture(gesture);
		} else {
			gesture = {
				scale: gesture.scale * (1 - (WHEEL_SPEEDUP * dy) / 100),
				origin: origin(element, [e.clientX, e.clientY])
			};
			doGesture(gesture);
		}
		if (timer) {
			window.clearTimeout(timer);
		}
		timer = window.setTimeout(() => {
			if (gesture) {
				endGesture(gesture);
				gesture = null;
			}
		}, 200);
	});

	let initial_touches;
	function touchMove(e) {
		if (e.touches.length === 2) {
			let mp_init = midpoint(initial_touches);
			let mp_curr = midpoint(e.touches);
			gesture = {
				scale: distance(e.touches) / distance(initial_touches),
				rotation: angle(e.touches) - angle(initial_touches),
				translation: [mp_curr.x - mp_init.x, mp_curr.y - mp_init.y],
				origin: origin(element, mp_init)
			};
			doGesture(gesture);
			e.preventDefault();
		}
	}

	element.addEventListener('touchstart', function watchTouches(e) {
		if (e.touches.length === 2) {
			gesture = {
				scale: 1,
				rotation: 0,
				translation: [0, 0],
				origin: origin(element, midpoint(initial_touches))
			};
			e.preventDefault();
			startGesture(gesture);
			element.addEventListener('touchmove', touchMove);
			element.addEventListener('touchend', watchTouches);
			element.addEventListener('touchcancel', watchTouches);
		} else if (gesture) {
			endGesture(gesture);
			gesture = null;
			element.removeEventListener('touchmove', touchMove);
			element.removeEventListener('touchend', watchTouches);
			element.removeEventListener('touchcancel', watchTouches);
		}
	});

	if (
		typeof GestureEvent !== 'undefined' &&
		typeof TouchEvent === 'undefined'
	) {
		element.addEventListener('gesturestart', function handleGestureStart(e) {
			startGesture({
				scale: e.scale,
				rotation: e.rotation,
				origin: origin(element, [e.clientX, e.clientY])
			});
			e.preventDefault();
		});
		element.addEventListener('gesturechange', function handleGestureChange(e) {
			doGesture({
				scale: e.scale,
				rotation: e.rotation,
				origin: origin(element, [e.clientX, e.clientY])
			});
			e.preventDefault();
		});
		element.addEventListener('gestureend', function handleGestureEnd(e) {
			endGesture({
				scale: e.scale,
				rotation: e.rotation,
				origin: origin(element, [e.clientX, e.clientY])
			});
		});
	}
}
