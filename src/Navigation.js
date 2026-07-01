

export class Navigation {
	constructor() {
		this.navButtons = document.querySelectorAll('.btn-nav');
		this.screens = document.querySelectorAll('.screen');
		this._onScreenChange = null;

		this._bind();
	}

	onScreenChange(callback) {
		this._onScreenChange = callback;
	}

	_bind() {
		this.navButtons.forEach(button => {
			button.addEventListener('click', this._onNavButtonClick.bind(this, button));
		});
	}

	_onNavButtonClick(button) {
		const screenName = button.getAttribute('data-screen');
		this.switchScreen(screenName);

		this._onScreenChange && this._onScreenChange(screenName);
	}

	switchScreen(screenName) {
		this.screens.forEach(screen => {
			if (screen.id === `screen-${screenName}`) {
				screen.classList.remove('--hidden');
			} else {
				screen.classList.add('--hidden');
			}
		});

		this.navButtons.forEach(button => {
			if (button.getAttribute('data-screen') === screenName) {
				button.classList.add('--active');
			} else {
				button.classList.remove('--active');
			}
		});
	}
}