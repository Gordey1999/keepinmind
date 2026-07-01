export class TrainPage {
	constructor(firebaseService, speechService) {
		this.fb = firebaseService;
		this.speech = speechService;

		this._queue = [];

		// Элементы интерфейса
		this._el = document.getElementById('screen-train');
		this._cardsLeftEl = document.getElementById('cards-left');

		this._cardCategory = this._el.querySelector('.card__category');
		this._cardWord = this._el.querySelector('.card__word');
		this._btnAudio = this._el.querySelector('.btn-audio');

		// Зона проверки
		this._inputZone = document.getElementById('card-check-zone');
		this._inputAnswer = document.getElementById('train-answer-input');
		this._btnCheck = document.getElementById('btn-check-answer');

		// Зона перевода
		this._cardTranslation = document.getElementById('card-translation');
		this._correctAnswerText = document.getElementById('correct-answer-text');
		this._resultBadge = document.getElementById('check-result-badge');
		this._btnShowHint = document.getElementById('btn-show-hint');

		// Кнопки результата
		this._actionsZone = this._el.querySelector('.train__actions');
		this._btnDontRemember = this._el.querySelector('.--dont-remember');
		this._btnRemember = this._el.querySelector('.--remember');

		this._finishedMsg = document.getElementById('train-finished-msg');

		this._nextTimeText = document.getElementById('train-next-time-text');
		this._timerId = null;

		this._bind();
	}

	_bind() {
		this._btnCheck.addEventListener('click', this._checkAnswer.bind(this));
		this._inputAnswer.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') this._checkAnswer();
		});

		this._btnShowHint.addEventListener('click', this._showTranslation.bind(this));
		this._btnAudio.addEventListener('click', this._pronounceCurrent.bind(this));

		this._btnRemember.addEventListener('click', () => this._handleRemember());
		this._btnDontRemember.addEventListener('click', () => this._handleDontRemember());
	}

	async startTraining() {
		this._resetUI();
		this._finishedMsg.classList.add('--hidden');
		this._el.querySelector('.card').classList.remove('--hidden');
		this._actionsZone.classList.remove('--hidden');
		this._cardsLeftEl.parentElement.classList.remove('--hidden');

		try {
			const allWords = await this.fb.getWords();
			const now = new Date();

			this._queue = allWords.filter(word => {
				return new Date(word.nextReviewDate) <= now;
			}).slice(0, 15);

			this._showCard();
		} catch (err) {
			console.error(err);
		}
	}

	_showCard() {
		if (!this._queue.length) {
			this._showFinished();
			return;
		}

		this._cardsLeftEl.innerText = this._queue.length;
		const currentWord = this._queue[0];

		this._cardCategory.innerText = `Категория: ${currentWord.category}`;
		this._cardWord.innerText = currentWord.hint;
		this._correctAnswerText.innerText = currentWord.term;

		if (!this._canPronounce(currentWord)) {
			this._btnAudio.classList.add('--hidden'); // Скрываем динамик
		} else {
			this._btnAudio.classList.remove('--hidden'); // Показываем динамик
		}

		const hasPunctuation = /[.,()\-!?/;:]/.test(currentWord.term);
		// 3. Условие для показа поля ввода: если длина ответа (подсказки) меньше 30 символов
		if (currentWord.term.length < 30 && !hasPunctuation) {
			this._inputZone.classList.remove('--hidden');
		} else {
			this._inputZone.classList.add('--hidden');
		}

		// Сбрасываем состояние полей для нового слова
		this._inputAnswer.value = '';
		this._inputAnswer.className = '';
		this._inputAnswer.disabled = false;
		this._btnCheck.disabled = false;

		this._cardTranslation.classList.add('--hidden');
		this._resultBadge.className = 'card__result-badge --hidden';

		// Фокусируемся на вводе только если поле доступно
		if (currentWord.term.length < 30 && !hasPunctuation) {
			this._inputAnswer.focus();
		}
	}

	_pronounceCurrent() {
		const currentWord = this._queue[0];
		if (currentWord) {
			this.speech.speak(currentWord.term);
		}
	}

	// 🔄 НОВАЯ ЛОГИКА ПРОВЕРКИ: бесконечные попытки
	_checkAnswer() {
		const userAnswer = this._inputAnswer.value.trim().toLowerCase();
		const currentWord = this._queue[0];
		const correctAnswer = currentWord.term.trim().toLowerCase();

		// Сбрасываем старые классы подсветки перед новой проверкой
		this._inputAnswer.className = '';

		if (userAnswer === correctAnswer) {
			// Если верно — подсвечиваем, блокируем поле и показываем перевод
			this._inputAnswer.classList.add('--success');
			this._resultBadge.innerText = 'Верно!';
			this._resultBadge.className = 'card__result-badge --success';
			this._inputAnswer.disabled = true;
			this._btnCheck.disabled = true;
			this._showTranslation();

			if (this._canPronounce(currentWord)) {
				setTimeout(() => this._pronounceCurrent(), 100);
			}
		} else {
			// Если неверно — просто говорим об этом. Поле ОСТАЕТСЯ активным для новых попыток
			this._inputAnswer.classList.add('--error');
			this._resultBadge.innerText = 'Неверно, попробуйте еще раз';
			this._resultBadge.className = 'card__result-badge --error';
		}
	}

	_canPronounce(word) {
		return !/[а-яА-ЯёЁ]/.test(word.term);
	}

	_showTranslation() {
		this._cardTranslation.classList.remove('--hidden');
	}

	async _handleRemember() {
		const currentWord = this._queue.shift();
		if (!currentWord) { return; }

		this._saveScore(currentWord, currentWord.failed ? 0 : 5);
		this._showCard();
	}

	async _handleDontRemember() {
		const currentWord = this._queue.shift();
		if (!currentWord) { return; }

		currentWord.failed = true;
		this._queue.push(currentWord);
		this._showCard();
	}

	async _saveScore(currentWord, score) {

		let { repetitions, interval, easeFactor } = currentWord;

		if (score >= 3) {
			if (repetitions === 0) {
				interval = 1;
			} else if (repetitions === 1) {
				interval = 6;
			} else {
				interval = Math.round(interval * easeFactor);
			}
			repetitions++;
		} else {
			repetitions = 0;
			interval = 1;
		}

		easeFactor = easeFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
		if (easeFactor < 1.3) easeFactor = 1.3;

		const nextDate = new Date();
		nextDate.setDate(nextDate.getDate() + interval);
		nextDate.setHours(4, 0, 0, 0); // Ровно 04:00:00 утра

		try {
			await this.fb.updateWordProgress(currentWord.id, {
				repetitions,
				interval,
				easeFactor,
				nextReviewDate: nextDate.toISOString()
			});
		} catch (err) {
			console.error(err);
			alert('Ошибка при сохранении прогресса в облако');
		}
	}

	// Замените метод _showFinished в TrainPage.js на этот:
	async _showFinished() {
		this._resetUI();
		this._finishedMsg.classList.remove('--hidden');

		// Очищаем старый таймер, если он работал
		if (this._timerId) clearInterval(this._timerId);
		this._nextTimeText.innerText = 'Расчет времени следующего повторения...';

		try {
			// Запрашиваем все слова, чтобы найти те, которые ждут своей очереди
			const allWords = await this.fb.getWords();
			const now = new Date();

			// Отбираем только те слова, время которых еще НЕ пришло
			const futureWords = allWords.filter(word => new Date(word.nextReviewDate) > now);

			if (futureWords.length === 0) {
				// Если в базе вообще нет слов на будущее (словарь пуст или все слова новые и сброшены)
				this._nextTimeText.innerText = 'Добавьте новые слова в словарь, чтобы продолжить тренировки!';
				return;
			}

			// Находим самое ближайшее слово (сортируем по возрастанию даты)
			futureWords.sort((a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate));
			const closestWordDate = new Date(futureWords[0].nextReviewDate);

			// Запускаем динамический таймер обратного отсчета
			const updateTimer = () => {
				const currentTime = new Date();
				const diffMs = closestWordDate - currentTime;

				if (diffMs <= 0) {
					// Если время ожидания вышло прямо пока пользователь смотрел на экран
					this._nextTimeText.innerHTML = `Новые слова уже доступны! <button class="btn-primary" style="padding: 4px 10px; font-size: 0.85rem; margin-left: 5px;" onclick="window.nav.switchScreen('train'); location.reload();">Повторить</button>`;
					clearInterval(this._timerId);
					return;
				}

				// Переводим миллисекунды в часы и минуты
				const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
				const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

				// Склоняем слова для красивого вывода
				const hoursStr = this._pluralize(diffHours, ['час', 'часа', 'часов']);
				const minutesStr = this._pluralize(diffMinutes, ['минуту', 'минуты', 'минут']);

				if (diffHours > 0) {
					this._nextTimeText.innerText = `Следующее слово появится через ${diffHours} ${hoursStr} и ${diffMinutes} ${minutesStr}.`;
				} else {
					this._nextTimeText.innerText = `Следующее слово появится всего через ${diffMinutes} ${minutesStr}!`;
				}
			};

			// Запускаем таймер сразу и настраиваем обновление каждую минуту (60000 мс)
			updateTimer();
			this._timerId = setInterval(updateTimer, 60000);

		} catch (err) {
			console.error(err);
			this._nextTimeText.innerText = 'Возвращайтесь завтра для продолжения повторений!';
		}
	}

	// Вспомогательный метод для склонения слов (русский язык)
	_pluralize(number, titles) {
		const mod10 = number % 10;
		const mod100 = number % 100;

		// 1. Исключения: от 11 до 14 всегда используется родительский падеж (минут, часов)
		if (mod100 >= 11 && mod100 <= 14) {
			return titles[2];
		}

		// 2. Для чисел, оканчивающихся на 1 (кроме 11) -> минута, час
		if (mod10 === 1) {
			return titles[0];
		}

		// 3. Для чисел, оканчивающихся на 2, 3, 4 (кроме 12, 13, 14) -> минуты, часа
		if (mod10 >= 2 && mod10 <= 4) {
			return titles[1];
		}

		// 4. Во всех остальных случаях (5, 6, 7, 8, 9, 0) -> минут, часов
		return titles[2];
	}


	_resetUI() {
		this._el.querySelector('.card').classList.add('--hidden');
		this._actionsZone.classList.add('--hidden');
		this._cardsLeftEl.parentElement.classList.add('--hidden');
	}
}
