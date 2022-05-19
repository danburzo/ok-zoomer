const WHEEL_SCALE_SPEEDUP = 2;
const WHEEL_TRANSLATION_SPEEDUP = 2;
const DELTA_LINE_MULTIPLIER = 8;
const DELTA_PAGE_MULTIPLIER = 24;
const MAX_WHEEL_DELTA = 24;

function limit(delta, max_delta) {
	return Math.sign(delta) * Math.min(max_delta, Math.abs(delta));
}

function normalizeWheel(e) {
	let dx = e.deltaX;
	let dy = e.deltaY;
	if (e.shiftKey && dx === 0) {
		[dx, dy] = [dy, dx];
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

function midpoint(touches) {
	let [t1, t2] = touches;
	return {
		x: (t1.clientX + t2.clientX) / 2,
		y: (t1.clientY + t2.clientY) / 2
	};
}

function distance(touches) {
	let [t1, t2] = touches;
	return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

function angle(touches) {
	let [t1, t2] = touches;
	let dx = t2.clientX - t1.clientX;
	let dy = t2.clientY - t1.clientY;
	return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function okzoomer(container, opts) {
	function noop() {
		/* do nothing */
	}

	let options = opts || {};

	let startGesture = options.startGesture || noop;
	let doGesture = options.doGesture || noop;
	let endGesture = options.endGesture || noop;

	let wheel_gesture = null;
	let timer;
	container.addEventListener(
		'wheel',
		function wheelListener(e) {
			if (e.cancelable !== false) {
				e.preventDefault();
			}
			let [dx, dy] = normalizeWheel(e);

			if (!wheel_gesture) {
				wheel_gesture = {
					origin: { x: e.clientX, y: e.clientY },
					scale: 1,
					translation: { x: 0, y: 0 }
				};
				startGesture(wheel_gesture);
			}

			if (e.ctrlKey) {
				// pinch-zoom gesture
				let factor = dy <= 0 ? 
					1 - WHEEL_SCALE_SPEEDUP * dy / 100 : 
					1 / (1 + WHEEL_SCALE_SPEEDUP * dy / 100);
				wheel_gesture = {
					origin: { x: e.clientX, y: e.clientY },
					scale: wheel_gesture.scale * factor,
					translation: wheel_gesture.translation
				};
			} else {
				// pan gesture
				wheel_gesture = {
					origin: { x: e.clientX, y: e.clientY },
					scale: wheel_gesture.scale,
					translation: {
						x:
							wheel_gesture.translation.x -
							WHEEL_TRANSLATION_SPEEDUP * dx,
						y:
							wheel_gesture.translation.y -
							WHEEL_TRANSLATION_SPEEDUP * dy
					}
				};
			}
			doGesture(wheel_gesture);

			if (timer) {
				window.clearTimeout(timer);
			}
			timer = window.setTimeout(function () {
				if (wheel_gesture) {
					endGesture(wheel_gesture);
					wheel_gesture = null;
				}
			}, 200);
		},
		{
			passive: false
		}
	);

	let initial_touches;
	let touch_gesture = null;
	function touchMove(e) {
		if (e.touches.length === 2) {
			let mp_init = midpoint(initial_touches);
			let mp_curr = midpoint(e.touches);
			touch_gesture = {
				scale:
					e.scale !== undefined
						? e.scale
						: distance(e.touches) / distance(initial_touches),
				rotation:
					e.rotation !== undefined
						? e.rotation
						: angle(e.touches) - angle(initial_touches),
				translation: {
					x: mp_curr.x - mp_init.x,
					y: mp_curr.y - mp_init.y
				},
				origin: mp_init
			};
			doGesture(touch_gesture);
			if (e.cancelable !== false) {
				e.preventDefault();
			}
		}
	}

	container.addEventListener(
		'touchstart',
		function watchTouches(e) {
			if (e.touches.length === 2) {
				initial_touches = e.touches;
				touch_gesture = {
					scale: 1,
					rotation: 0,
					translation: { x: 0, y: 0 },
					origin: midpoint(initial_touches)
				};
				if (e.type === 'touchstart' && e.cancelable !== false) {
					e.preventDefault();
				}
				startGesture(touch_gesture);
				container.addEventListener('touchmove', touchMove, {
					passive: false
				});
				container.addEventListener('touchend', watchTouches);
				container.addEventListener('touchcancel', watchTouches);
			} else if (touch_gesture) {
				endGesture(touch_gesture);
				touch_gesture = null;
				container.removeEventListener('touchmove', touchMove);
				container.removeEventListener('touchend', watchTouches);
				container.removeEventListener('touchcancel', watchTouches);
			}
		},
		{ passive: false }
	);

	if (
		typeof GestureEvent !== 'undefined' &&
		typeof TouchEvent === 'undefined'
	) {
		let in_gesture = false;
		container.addEventListener(
			'gesturestart',
			function handleGestureStart(e) {
				if (!in_gesture) {
					startGesture({
						translation: { x: 0, y: 0 },
						scale: e.scale,
						rotation: e.rotation,
						origin: { x: e.clientX, y: e.clientY }
					});
					in_gesture = true;
				}
				if (e.cancelable !== false) {
					e.preventDefault();
				}
			},
			{ passive: false }
		);
		container.addEventListener(
			'gesturechange',
			function handleGestureChange(e) {
				if (in_gesture) {
					doGesture({
						translation: { x: 0, y: 0 },
						scale: e.scale,
						rotation: e.rotation,
						origin: { x: e.clientX, y: e.clientY }
					});
				}
				if (e.cancelable !== false) {
					e.preventDefault();
				}
			},
			{ passive: false }
		);
		container.addEventListener('gestureend', function handleGestureEnd(e) {
			if (in_gesture) {
				endGesture({
					translation: { x: 0, y: 0 },
					scale: e.scale,
					rotation: e.rotation,
					origin: { x: e.clientX, y: e.clientY }
				});
				in_gesture = false;
			}
		});
	}
}

function gestureToMatrix(gesture, origin) {
	return new DOMMatrix()
		.translate(origin.x, origin.y)
		.translate(gesture.translation.x || 0, gesture.translation.y || 0)
		.rotate(gesture.rotation || 0)
		.scale(gesture.scale || 1)
		.translate(-origin.x, -origin.y);
}

function getOrigin(el, gesture) {
	if (el instanceof HTMLElement) {
		let rect = el.getBoundingClientRect();
		return {
			x: gesture.origin.x - rect.x,
			y: gesture.origin.y - rect.y
		};
	}
	if (el instanceof SVGElement) {
		let matrix = el.ownerSVGElement.getScreenCTM().inverse();
		let pt = new DOMPoint(gesture.origin.x, gesture.origin.y);
		return pt.matrixTransform(matrix);
	}
	throw new Error('Expected HTML or SVG element');
}

function applyMatrix(el, matrix) {
	if (el instanceof HTMLElement) {
		el.style.transform = matrix;
		return;
	}
	if (el instanceof SVGElement) {
		el.setAttribute('transform', matrix);
		return;
	}
	throw new Error('Expected HTML or SVG element');
}

export { okzoomer, gestureToMatrix, getOrigin, applyMatrix };
