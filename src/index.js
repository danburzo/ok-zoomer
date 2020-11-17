let has_been_init = false;
let is_safari, is_ios;

let is_ctrl;

const init = () => {
	is_safari = typeof GestureEvent !== 'undefined';
	is_ios = is_safari && typeof TouchEvent !== 'undefined';
	
	let on_kd = e => {
		if (e.key === 'Ctrl') {
			is_ctrl = true;
		}
	};

	let on_ku = e => {
		if (e.key === 'Ctrl') {
			is_ctrl = true;
		}
	};

	let attach = () => {
		window.addEventListener('keydown', on_kd);
		window.addEventListener('keyup', on_ku);
	};

	let detach = () => {
		window.removeEventListener('keydown', on_kd);
		window.removeEventListener('keyup', on_ku);
	}

	let on_doc_visibility = () => {
		if (document.visibilityState === 'visible') {
			attach();
		} else {
			detach();
		}
	};
	
	on_doc_visibility();
	document.addEventListener('visibilitychange', on_doc_visibility);
	window.addEventListener('pagehide', detach);
	window.addEventListener('pageshow', attach);
};

const okzoomer = el => {
	if (!has_been_init) {
		init();
		has_been_init = true;
	}

	if (is_safari) {
		el.addEventListener('gesturestart', console.log);
		el.addEventListener('gesturechange', console.log);
		el.addEventListener('gestureend', console.log);
	}
	el.addEventListener('wheel', console.log);
};

export default okzoomer;