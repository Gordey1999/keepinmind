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

		// Кнопки результата
		this._actionsZone = this._el.querySelector('.train__actions');
		this._btnMainReveal = document.getElementById('btn-main-reveal');
		this._scorePanel = document.getElementById('train-score-panel');

		this._btnStillForget = this._scorePanel.querySelector('.js-btn-still-forget');
		this._standardScoreButtons = this._scorePanel.querySelectorAll('.js-score-standard');
		this._btnNowRemember = this._scorePanel.querySelector('.js-btn-now-remember');


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

		this._btnMainReveal.addEventListener('click', this._revealCard.bind(this));

		this._btnAudio.addEventListener('click', this._pronounceCurrent.bind(this));

		this._scorePanel.addEventListener('click', (e) => {
			const btn = e.target.closest('.btn-score');
			if (!btn) return;

			const scoreAttr = btn.getAttribute('data-score');

			if (scoreAttr === 'still-forget') {
				// Нажали "Все еще не помню" -> отправляем специальный сигнал
				this._handleUserScore(0);
			} else if (scoreAttr === 'now-remember') {
				// Нажали "Теперь помню" -> отправляем сигнал на завершение
				this._handleUserScore(1);
			} else {
				// Обычные кнопки (0, 3, 4, 5)
				const score = parseInt(scoreAttr, 10);
				this._handleUserScore(score);
			}
		});
	}

	async startTraining() {
		if (this._timerId) clearInterval(this._timerId);

		this._resetUI();
		this._finishedMsg.classList.add('--hidden');
		this._el.querySelector('.card').classList.remove('--hidden');
		this._actionsZone.classList.remove('--hidden');
		this._cardsLeftEl.parentElement.classList.remove('--hidden');

		try {
			const allWords = await this.fb.getWords();
			const now = new Date();

	        // 1. Отбираем все слова, у которых дата повторения меньше или равна текущей
	        const availableWords = allWords.filter(word => {
					return new Date(word.nextReviewDate) <= now;
				});

	        // 2. Сортируем слова по приоритету, чтобы тренировка была эффективной:
	        // - Сначала идут слова с меньшим количеством успешных повторений подряд (они самые шаткие)
	        // - Затем более стабильные слова
	        availableWords.sort((a, b) => {
	            const repsA = a.repetitions || 0;
	            const repsB = b.repetitions || 0;
	            return repsA - repsB;
	        });

	        // 3. 🌟 ВНЕДРЯЕМ ЛИМИТ: берем ровно первые 20 слов из отсортированного списка
	        this._queue = availableWords.slice(0, 20);

			this._showCard();
		} catch (err) {
			console.error(err);
			alert('Ошибка при загрузке пула тренировки');
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

		this._btnMainReveal.classList.remove('--hidden');
		this._scorePanel.classList.add('--hidden');

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

	_revealCard() {
		this._cardTranslation.classList.remove('--hidden');

		if (this._canPronounce(this._queue[0])) {
			this._pronounceCurrent();
		}

		this._btnMainReveal.classList.add('--hidden');
		this._scorePanel.classList.remove('--hidden');

	    // ПРОВЕРКА: Проходила ли карточка через круг ошибок в этой сессии?
	    const currentWord = this._queue[0];
	    if (currentWord && currentWord.failed) {
	        // Если слово уже забывали — прячем 4 кнопки и выводим одну большую
	        this._standardScoreButtons.forEach(btn => btn.classList.add('--hidden'));

		    this._btnStillForget.classList.remove('--hidden');
		    this._btnNowRemember.classList.remove('--hidden');
	    } else {
	        // Если это первый показ слова — возвращаем стандартную панель оценок
	        this._standardScoreButtons.forEach(btn => btn.classList.remove('--hidden'));

		    this._btnStillForget.classList.add('--hidden');
		    this._btnNowRemember.classList.add('--hidden');
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
			this._revealCard();
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

	async _handleUserScore(score) {
		const currentWord = this._queue.shift(); // Извлекаем текущее слово из начала очереди
		if (!currentWord) return;

		if (score === 0) {
			currentWord.failed = true;
			this._queue.push(currentWord); // Кидаем в конец очереди сессии
		} else if (currentWord.failed) {
			this._saveScore(currentWord, 0);
		} else {
			this._saveScore(currentWord, score);

			// В конец очереди текущей сессии слово БОЛЬШЕ НЕ ПУШИТСЯ, тренировка по нему завершена
		}

		this._showCard();
	}

	async _saveScore(currentWord, score) {

		let { repetitions, interval, easeFactor } = currentWord;

		const nextDate = new Date(); // Текущий момент времени

		if (score >= 3) {
			if (repetitions === 0) {
				interval = 1;
			} else if (repetitions === 1) {
				interval = 6;
			} else {
				interval = Math.round(interval * easeFactor);
			}
			repetitions++;

			nextDate.setDate(nextDate.getDate() + interval);
			nextDate.setHours(4, 0, 0, 0); // Ровно 04:00:00 утра
		} else {
			// 🌟 НАШ НОВЫЙ РЕЖИМ «ЧЕРЕЗ ЧАС»:
			repetitions = 0;
			interval = 1;
			nextDate.setHours(nextDate.getHours() + 1); // +1 час к текущему времени
		}

		easeFactor = easeFactor + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02));
		if (easeFactor < 1.3) easeFactor = 1.3;

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
