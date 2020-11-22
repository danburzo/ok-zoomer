let has_been_init = false;
let is_ios;
let monitor;

function initialize() {
	if (has_been_init) return;
	is_ios = typeof GestureEvent !== 'undefined' && typeof TouchEvent !== 'undefined';
	monitor = keyMonitor('Control');
	has_been_init = true;
};

/*
	Monitor (mostly accurately) the pressed state 
	of a key or array of keys on the keyboard.
 */
function keyMonitor(keys) {
	// We assume no keys are pressed at initialization-time
	let activeKeys = new Set();
	if (keys) {
		// Accept either a string or an array
		let watchedKeys = new Set(Array.isArray(keys) ? keys : [keys]);
		window.addEventListener('keydown', e => watchedKeys.has(e.key) && activeKeys.add(e.key), { capture: true });
		window.addEventListener('keyup', e =>  watchedKeys.has(e.key) && activeKeys.remove(e.key), { capture: true });
		window.addEventListener('pagehide', () => activeKeys.clear());
		window.addEventListener('blur', () => activeKeys.clear());
		document.addEventListener('visibilitychange', () => document.visibilityState !== 'visible' && activeKeys.clear());
	}
	return activeKeys;
};

function normalizeWheel(e) {

	let dx = e.deltaX;
	let dy = e.deltaY;

	if (e.shiftKey && dx === 0) {
		let tmp = dx;
		dx = dy;
		dy = tmp;
	}

	if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
		dx *= 8;
		dy *= 8;
	} else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		dx *= 24;
		dy *= 24;
	}

	return [dx, dy];
};

function okzoomer(el) {
	initialize();


	if (typeof TouchEvent !== 'undefined') {

		let has_gesture = false;
		let initial_touches;

		function touchstart(e) {
			el.addEventListener('touchmove', touchmove);
			el.addEventListener('touchend', touchend);
			// Touch starts with two fingers directly
			if (e.targetTouches.length === 2) {
				touchmove(e);
			}
		};

		function gestureCenter(touches) {
			return {
				clientX: (touches[0].clientX + touches[1].clientX)/2, 
				clientY: (touches[0].clientY + touches[1].clientY)/2
			};
		}

		function distance(touches) {
			return Math.sqrt(
				Math.pow(touches[0].clientX - touches[1].clientX, 2) + Math.pow(touches[0].clientY - touches[1].clientY, 2)
			);
		}

		function angle(touches) {
			return 180 / Math.PI * Math.atan2(touches[1].clientY - touches[0].clientY, touches[1].clientX - touches[0].clientX);
		}

		function translation(new_touches, initial_touches) {
			let new_c = gestureCenter(new_touches);
			let initial_c = gestureCenter(initial_touches);
			return {
				x: new_c.clientX - initial_c.clientX,
				y: new_c.clientYT - initial_c.clientY
			};
		}

		function rotation(new_touches, initial_touches) {
			return angle(new_touches) - angle(initial_touches);	
		}

		function scale(new_touches, initial_touches) {
			return distance(new_touches) / distance(initial_touches);
		}
		
		function touchmove(e) {
			if (e.targetTouches.length === 2) {
				if (!has_gesture) {
					initial_touches = [
						{ clientX: e.targetTouches[0].clientX, clientY: e.targetTouches[0].clientY },
						{ clientX: e.targetTouches[1].clientX, clientY: e.targetTouches[1].clientY }	
					];
					el.dispatchEvent(
						new CustomEvent('gesturestart', {
							detail: {
								...gestureCenter(initial_touches),
								scale: 1,
								rotation: 0,
								translation: 0
							}
						})
					);
					has_gesture = true;
				} else {
					el.dispatchEvent(
						new CustomEvent('gesturechange', {
							detail: {
								...gestureCenter(e.targetTouches),
								scale: scale(e.targetTouches, initial_touches),
								rotation: rotation(e.targetTouches, initial_touches),
								translation: translation(e.targetTouches, initial_touches)
							}
						})
					);
				}
				e.preventDefault();
			} else if (has_gesture) {
				el.dispatchEvent(
					new CustomEvent('gestureend', {
						// Should we send details here?
						detail: null
					})
				);
				has_gesture = false;
				e.preventDefault();
			}
		};

		function touchend(e) {
			el.removeEventListener('touchmove', touchmove);
			el.removeEventListener('touchend', touchend);
			e.preventDefault();
		};

		el.addEventListener('touchstart', touchstart);
	}

	/*
		Safari
	 */
	if (typeof TouchEvent !== 'undefined' || typeof GestureEvent !== 'undefined') {
		el.addEventListener('gesturestart', e => {
			// Prevent pinch-out-of-page gesture
			console.log(e);
			e.preventDefault();
		});
		
		el.addEventListener('gesturechange', e => {
			// Prevent pinch-out-of-page gesture
			console.log(e);
			e.preventDefault();
		});

		el.addEventListener('gestureend', e => {
			console.log(e);
		});
	}
	el.addEventListener('wheel', e => {
		let handled = false;
		let is_ctrl = monitor.has('Control');
		let [dx, dy] = normalizeWheel(e, is_ctrl);
		if (e.ctrlKey && !is_ctrl) {
			// Pinch gesture
			console.log('pinch');
			handled = true;
		}
		if (!handled && ((e.ctrlKey && is_ctrl) || e.metaKey)) {
			// Ctrl + Wheel
			console.log('ctrl + wheel, ctrl + pinch');
			handled = true;
		}

		// Prevent history navigation behavior in Firefox
		// on Alt + Wheel shortcut.
		if (!handled && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
			handled = true;
		}
		if (handled) {
			e.preventDefault();
		}
	});
};

export { okzoomer, normalizeWheel, keyMonitor };