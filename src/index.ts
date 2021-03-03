declare global {
	/*
    TouchEvent' `scale` and `rotation` properties aren't standardized:
    https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
  */
	interface TouchEvent {
		scale?: number;
		rotation?: number;
	}

	/*
    GestureEvents aren't standardized:
    https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent
    https://developer.apple.com/documentation/webkitjs/gestureevent
  */
	interface GestureEvent extends Event {
		altKey: boolean;
		ctrlKey: boolean;
		metaKey: boolean;
		shiftKey: boolean;
		scale: number;
		rotation: number;
		clientX: number;
		clientY: number;
		screenX: number;
		screenY: number;
	}
	// extends the original ElementEventMap
	interface ElementEventMap {
		gesturestart: GestureEvent;
		gesturechange: GestureEvent;
		gestureend: GestureEvent;
	}
	// required to check for its existence
	interface Window {
		GestureEvent: any;
	}
}

export type Gesture = {
	origin: Coords;
	translation: Coords;
	scale: number;
	rotation?: number;
};

export type Coords = {
	x: number;
	y: number;
};

const WHEEL_SCALE_SPEEDUP = 2;
const WHEEL_TRANSLATION_SPEEDUP = 2;
const DELTA_LINE_MULTIPLIER = 8;
const DELTA_PAGE_MULTIPLIER = 24;
const MAX_WHEEL_DELTA = 24;

function normalizeWheel(e: WheelEvent): [number, number] {
	let dx = e.deltaX;
	let dy = e.deltaY;
	if (e.shiftKey && dx === 0) {
		const tmp = dx;
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

function limit(delta: number, max_delta: number): number {
	return Math.sign(delta) * Math.min(max_delta, Math.abs(delta));
}

function midpoint(touches: TouchList): Coords {
	const t1 = touches[0];
	const t2 = touches[1];
	return {
		x: (t1.clientX + t2.clientX) / 2,
		y: (t1.clientY + t2.clientY) / 2
	};
}

function distance(touches: TouchList): number {
	const t1 = touches[0];
	const t2 = touches[1];
	const dx = t2.clientX - t1.clientX;
	const dy = t2.clientY - t1.clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

function angle(touches: TouchList): number {
	const t1 = touches[0];
	const t2 = touches[1];
	const dx = t2.clientX - t1.clientX;
	const dy = t2.clientY - t1.clientY;
	return (180 / Math.PI) * Math.atan2(dy, dx);
}

export function clientToHTMLElementCoords(
	element: HTMLDivElement,
	coords: Coords
): Coords {
	const rect = element.getBoundingClientRect();
	return {
		x: coords.x - rect.x,
		y: coords.y - rect.y
	};
}

export function clientToSVGElementCoords(
	el: SVGSVGElement,
	coords: Coords
): Coords {
	const element: SVGSVGElement = !el.ownerSVGElement ? el : el.ownerSVGElement;
	const screen_to_el = element.getScreenCTM()?.inverse();
	const point = element.createSVGPoint();
	point.x = coords.x;
	point.y = coords.y;
	return point.matrixTransform(screen_to_el);
}

type Options = {
	startGesture?: (gesture: Gesture) => void;
	doGesture?: (gesture: Gesture) => void;
	endGesture?: (gesture: Gesture) => void;
};

export function okzoomer(container: Element, options: Options): () => void {
	function noop() {
		/* do nothing */
	}

	const startGesture = options.startGesture ?? noop;
	const doGesture = options.doGesture ?? noop;
	const endGesture = options.endGesture ?? noop;

	// TODO: we shouldn't be reusing gesture
	let gesture: Gesture | null = null;
	let timer: number;

	function wheelListener(e: WheelEvent) {
		e.preventDefault();
		const [dx, dy] = normalizeWheel(e);
		if (!gesture) {
			gesture = {
				scale: 1,
				translation: { x: 0, y: 0 },
				origin: { x: e.clientX, y: e.clientY }
			};
			startGesture(gesture);
		} else {
			gesture = {
				origin: { x: e.clientX, y: e.clientY },
				scale: e.ctrlKey
					? gesture.scale * (1 - (WHEEL_SCALE_SPEEDUP * dy) / 100)
					: 1,
				translation: !e.ctrlKey
					? {
							x: gesture.translation.x - WHEEL_TRANSLATION_SPEEDUP * dx,
							y: gesture.translation.y - WHEEL_TRANSLATION_SPEEDUP * dy
					  }
					: { x: 0, y: 0 }
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
	}

	let initial_touches: TouchList;
	function touchMove(e: Event) {
		if (!(e instanceof TouchEvent)) return;
		if (e.touches.length === 2) {
			const mp_init = midpoint(initial_touches);
			const mp_curr = midpoint(e.touches);
			gesture = {
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
			doGesture(gesture);
			e.preventDefault();
		}
	}

	function watchTouches(e: Event) {
		if (!(e instanceof TouchEvent)) return;
		if (e.touches.length === 2) {
			initial_touches = e.touches;
			gesture = {
				scale: 1,
				rotation: 0,
				translation: { x: 0, y: 0 },
				origin: midpoint(initial_touches)
			};

			/*
				All the other events using `watchTouches` are passive,
				we don't need to call preventDefault().
			 */
			if (e.type === 'touchstart') {
				e.preventDefault();
			}
			startGesture(gesture);
			container.addEventListener('touchmove', touchMove, { passive: false });
			container.addEventListener('touchend', watchTouches);
			container.addEventListener('touchcancel', watchTouches);
		} else if (gesture) {
			endGesture(gesture);
			gesture = null;
			container.removeEventListener('touchmove', touchMove);
			container.removeEventListener('touchend', watchTouches);
			container.removeEventListener('touchcancel', watchTouches);
		}
	}

	document.addEventListener('wheel', wheelListener, { passive: false });
	container.addEventListener('touchstart', watchTouches, { passive: false });

	/*
    GestureEvent handling - Safari only
  */

	function handleGestureStart(e: GestureEvent) {
		startGesture({
			translation: { x: 0, y: 0 },
			scale: e.scale,
			rotation: e.rotation,
			origin: { x: e.clientX, y: e.clientY }
		});
		e.preventDefault();
	}

	function handleGestureChange(e: GestureEvent) {
		doGesture({
			translation: { x: 0, y: 0 },
			scale: e.scale,
			rotation: e.rotation,
			origin: { x: e.clientX, y: e.clientY }
		});
		e.preventDefault();
	}

	function handleGestureEnd(e: GestureEvent) {
		endGesture({
			translation: { x: 0, y: 0 },
			scale: e.scale,
			rotation: e.rotation,
			origin: { x: e.clientX, y: e.clientY }
		});
	}

	if (
		typeof window.GestureEvent !== 'undefined' &&
		typeof window.TouchEvent === 'undefined'
	) {
		container.addEventListener('gesturestart', handleGestureStart, {
			passive: false
		});
		container.addEventListener('gesturechange', handleGestureChange, {
			passive: false
		});
		container.addEventListener('gestureend', handleGestureEnd);
	}

	function unregister() {
		document.removeEventListener('wheel', wheelListener);
		container.removeEventListener('touchstart', watchTouches);
		if (
			navigator.userAgent.toLowerCase().indexOf('safari') !== -1 &&
			typeof TouchEvent === 'undefined'
		) {
			container.removeEventListener('gesturestart', handleGestureStart);
			container.removeEventListener('gesturechange', handleGestureChange);
			container.removeEventListener('gestureend', handleGestureEnd);
		}
	}

	return unregister;
}
