let has_been_init = false;
let is_safari, is_ios;
let monitor;

const init = () => {
	if (has_been_init) return;
	is_safari = typeof GestureEvent !== 'undefined';
	is_ios = is_safari && typeof TouchEvent !== 'undefined';
	monitor = keyMonitor(['Control']);
	has_been_init = true;
};

const keyMonitor = keys => {
	let watchlist = new Set(keys);
	let active = new Set();
	window.addEventListener('keydown', e => watchlist.has(e.key) && active.add(e.key), { capture: true });
	window.addEventListener('keyup', e =>  watchlist.has(e.key) && active.remove(e.key), { capture: true });
	window.addEventListener('pagehide', () => active.clear());
	window.addEventListener('blur', () => active.clear());
	document.addEventListener('visibilitychange', () => document.visibilityState !== 'visible' && (active.clear()));
	return active;
};

const normalizeWheel = (e, is_physical_ctrl_key) => {

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
		dx *= 16;
		dy *= 16;
	}

	return [dx, dy];
};

const okzoomer = (el, opts = {}) => {
	let options = {
		...opts
	};
	init();
	if (is_safari) {
		el.addEventListener('gesturestart', e => {
			// Prevent pinch-out-of-page gesture
			e.preventDefault();
		});
		
		el.addEventListener('gesturechange', e => {
			// Prevent pinch-out-of-page gesture
			e.preventDefault();
		});

		el.addEventListener('gestureend', e => {

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