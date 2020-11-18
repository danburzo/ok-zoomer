let has_been_init = false;
let is_safari, is_ios;
let is_ctrl = null;

const init = () => {
	if (has_been_init) return;
	is_safari = typeof GestureEvent !== 'undefined';
	is_ios = is_safari && typeof TouchEvent !== 'undefined';
	window.addEventListener('keydown', e => e.key === 'Control' && (is_ctrl = true), { capture: true });
	window.addEventListener('keyup', e => e.key === 'Control' && (is_ctrl = false), { capture: true });
	window.addEventListener('pagehide', () => is_ctrl = false);
	window.addEventListener('blur', () => is_ctrl = false);
	document.addEventListener('visibilitychange', () => document.visibilityState !== 'visible' && (is_ctrl = false));
	has_been_init = true;
};

const PIXEL_MODE = 0, LINE_MODE = 1, PAGE_MODE = 2;

const okzoomer = (el, opts = {}) => {
	let options = {
		/*
			The scaling factor for transforming 
			the `lines` deltaMode to the `pixels` deltaMode.
			The default is based on the Firefox about:config values.
		 */
		lineMultiplier: 100
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

		let dx = e.deltaX;
		let dy = e.deltaY;

		if (e.deltaMode === LINE_MODE) {
			dx *= options.lineMultiplier;
			dy *= options.lineMultiplier;
		} 

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
		if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
			handled = true;
		}
		if (handled) {
			e.preventDefault();
		}
	});
};

export default okzoomer;