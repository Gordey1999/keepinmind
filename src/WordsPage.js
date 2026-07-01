// src/WordsPage.js
export class WordsPage {
	constructor(firebaseService, navigation) {
		this.fb = firebaseService;
		this.nav = navigation;

		this._inputSearch = document.getElementById('words-search-input');
		this._cachedWords = [];

		// Элементы экрана списка слов
		this._wordsScreen = document.getElementById('screen-words');
		this._listContainer = document.getElementById('words-list-container');
		// НАХОДИМ КНОПКУ ТУТ:
		this._btnGoAddWord = document.getElementById('btn-go-add-word');

		// Элементы универсальной формы
		this._formScreen = document.getElementById('screen-word-form');
		this._formTitle = document.getElementById('form-title');
		this._form = document.getElementById('word-universal-form');

		this._inputId = document.getElementById('form-word-id');
		this._inputTerm = this._formScreen.querySelector('.js-form-term');
		this._inputHint = this._formScreen.querySelector('.js-form-hint');
		this._selectCategory = this._formScreen.querySelector('.js-form-category');
		this._btnSubmit = document.getElementById('btn-form-submit');
		// НАХОДИМ КНОПКУ ОТМЕНЫ ФОРМЫ:
		this._btnCancelWord = document.getElementById('btn-cancel-word');

		this._statsTotal = this._wordsScreen.querySelector('.js-stats-total');
		this._statsLvl0 = this._wordsScreen.querySelector('.js-stats-lvl0');
		this._statsLvl1 = this._wordsScreen.querySelector('.js-stats-lvl1');
		this._statsLvl2 = this._wordsScreen.querySelector('.js-stats-lvl2');
		this._statsLvl3 = this._wordsScreen.querySelector('.js-stats-lvl3');

		this._bind();
	}

	_bind() {
		// Слушаем отправку формы и клики по списку (удаление/редактирование)
		this._form.addEventListener('submit', this._onSaveWord.bind(this));
		this._listContainer.addEventListener('click', this._onListClick.bind(this));

		// ДОБАВЛЯЕМ СЛУШАТЕЛИ ДЛЯ КНОПОК ПЕРЕХОДА И ОТМЕНЫ:
		if (this._btnGoAddWord) {
			this._btnGoAddWord.addEventListener('click', () => {
				this.openForAdd();
			});
		}

		if (this._btnCancelWord) {
			this._btnCancelWord.addEventListener('click', () => {
				this.nav.switchScreen('words'); // Просто возвращаемся на экран списка
			});
		}

		if (this._inputSearch) {
			this._inputSearch.addEventListener('input', this._onSearch.bind(this));
		}
	}

	// Открытие формы в режиме добавления
	async openForAdd() {
		this._inputId.value = '';
		this._inputTerm.value = '';
		this._inputHint.value = '';
		this._formTitle.innerText = 'Добавить новое слово';

		// Метод обновит категории и восстановит ранее выбранную
		await this.updateCategoriesSelect();

		this.nav.switchScreen('word-form');
	}

	// Открытие формы в режиме редактирования
	async openForEdit(wordId) {
		this._formTitle.innerText = 'Редактировать слово';
		await this.updateCategoriesSelect();

		try {
			// Ищем данные слова локально из сохраненных на сервере
			const words = await this.fb.getWords();
			const currentWord = words.find(w => w.id === wordId);

			if (!currentWord) return;

			// Заполняем поля формы текущими значениями
			this._inputId.value = currentWord.id;
			this._inputTerm.value = currentWord.term;
			this._inputHint.value = currentWord.hint;
			this._selectCategory.value = currentWord.category;

			this.nav.switchScreen('word-form');
		} catch (err) {
			alert('Не удалось загрузить данные слова для редактирования');
		}
	}

	async updateCategoriesSelect() {
		const previousSelection = this._selectCategory.value;

		try {
			const categories = await this.fb.getCategories();
			this._selectCategory.innerHTML = '';

			if (categories.length === 0) {
				this._selectCategory.innerHTML = '<option value="">Сначала создайте категорию!</option>';
				return;
			}

			categories.forEach(cat => {
				const option = document.createElement('option');
				option.value = cat.name;
				option.textContent = cat.name;
				this._selectCategory.appendChild(option);
			});

			if (previousSelection) {
				// Проверяем, есть ли сохраненное имя среди загруженных категорий
				const itemStillExists = categories.some(cat => cat.name === previousSelection);
				if (itemStillExists) {
					this._selectCategory.value = previousSelection;
				}
			}
		} catch (err) {
			console.error('Ошибка заполнения категорий:', err);
		}
	}

	async renderList(wordsToRender = null) {
		// Если нам не передали готовый отфильтрованный массив, качаем свежие данные из Firebase
		if (wordsToRender === null) {
			this._listContainer.innerHTML = '<div class="word-row">Загрузка словаря...</div>';
			try {
				this._cachedWords = await this.fb.getWords();
				wordsToRender = this._cachedWords;
				// При полной перегрузке списка очищаем поле поиска
				if (this._inputSearch) this._inputSearch.value = '';
			} catch (err) {
				console.error(err);
				this._listContainer.innerHTML = '<div class="word-row">Ошибка загрузки словаря</div>';
				return;
			}
		}

    // Всегда обновляем общую статистику по ВСЕМУ кэшу слов (а не только по результатам поиска)
    this._updateSummaryStats(this._cachedWords);

		this._listContainer.innerHTML = '';

		if (wordsToRender.length === 0) {
			this._listContainer.innerHTML = '<div class="word-row">Ничего не найдено</div>';
			return;
		}

		const template = document.getElementById('word-item');
		wordsToRender.forEach(word => {
			const fragment = template.content.cloneNode(true);
			const row = fragment.querySelector('.word-item');

			row.dataset.id = word.id;
			row.querySelector('.word-item__term').innerText = word.term;
			row.querySelector('.word-item__sub').innerText = ` — ${word.hint} (${word.category})`;

        // --- ЛОГИКА ИНДИКАТОРОВ ЗАПОМИНАНИЯ ---
        const reps = word.repetitions || 0;
        const marker = row.querySelector('.word-item__level-marker');
        const progressBar = row.querySelector('.word-item__progress-bar');

        let color = '#ff3b30'; // красный по умолчанию (Новое)
        let percent = 5;       // минимальная ширина полоски

        if (reps === 0) {
            color = '#ff3b30';
            percent = 10;
        } else if (reps >= 1 && reps <= 3) {
            color = '#ff9500'; // оранжевый (Учится)
            percent = 25 + (reps * 10); // растет от 35% до 55%
        } else if (reps >= 4 && reps <= 7) {
            color = '#007aff'; // синий (Знаю)
            percent = 60 + ((reps - 3) * 10); // растет от 70% до 100%
        } else {
            color = '#34c759'; // зеленый (Усвоено навсегда)
            percent = 100;
        }

        // Применяем цвета и проценты шкалы загрузки
        if (marker) marker.style.backgroundColor = color;
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.style.backgroundColor = color;
        }
        // ----------------------------------------

			this._listContainer.appendChild(fragment);
		});
	}

	_updateSummaryStats(allWords) {
		const total = allWords.length;
		let lvl0 = 0; // новые
		let lvl1 = 0; // в процессе
		let lvl2 = 0; // хорошо знакомые
		let lvl3 = 0; // усвоенные

		allWords.forEach(word => {
			const reps = word.repetitions || 0;
			if (reps === 0) lvl0++;
			else if (reps >= 1 && reps <= 3) lvl1++;
			else if (reps >= 4 && reps <= 7) lvl2++;
			else lvl3++;
		});

		// Выводим цифры в интерфейс
		if (this._statsTotal) this._statsTotal.innerText = total;
		if (this._statsLvl0) this._statsLvl0.innerText = lvl0;
		if (this._statsLvl1) this._statsLvl1.innerText = lvl1;
		if (this._statsLvl2) this._statsLvl2.innerText = lvl2;
		if (this._statsLvl3) this._statsLvl3.innerText = lvl3;
	}


	// Универсальный обработчик сохранения (и для создания, и для обновления)
	async _onSaveWord(e) {
		e.preventDefault();

		const wordId = this._inputId.value; // Проверяем, есть ли ID
		const term = this._inputTerm.value.trim();
		const hint = this._inputHint.value.trim();
		const category = this._selectCategory.value;

		if (!term || !hint || !category) {
			alert('Заполните все поля');
			return;
		}

		this._btnSubmit.disabled = true;

		try {
			if (wordId) {
				// РЕЖИМ РЕДАКТИРОВАНИЯ
				await this.fb.updateWord(wordId, { term, hint, category });
			} else {
				// РЕЖИМ СОЗДАНИЯ
				const newWordData = {
					term, hint, category,
					repetitions: 0,
					interval: 1,
					easeFactor: 2.5,
					nextReviewDate: new Date().toISOString()
				};
				await this.fb.addWord(newWordData);
			}

			// ВМЕСТО ОЧИСТКИ ВСЕЙ ФОРМЫ (this._form.reset()):
			// Очищаем только текстовые поля. Селект при этом НЕ трогаем!
			this._inputTerm.value = '';
			this._inputHint.value = '';
			this._inputId.value = '';

			this.nav.switchScreen('words');
			await this.renderList();
		} catch (err) {
			console.error(err);
			alert('Ошибка при сохранении данных в облако');
		} finally {
			this._btnSubmit.disabled = false;
		}
	}

	async _onListClick(e) {
		const target = e.target;

		// 1. Клик по кнопке удаления
		const btnDelete = target.closest('.btn-delete-word');
		if (btnDelete) {
			const id = btnDelete.closest('.word-item').dataset.id;
			if (id && confirm('Удалить это слово?')) {
				try {
					await this.fb.deleteWord(id);
					await this.renderList();
				} catch (err) {
					console.error(err);
					alert('Ошибка при удалении');
				}
			}
			return;
		}

		// 2. Клик по кнопке редактирования
		const btnEdit = target.closest('.btn-edit-word');
		if (btnEdit) {
			const id = btnEdit.closest('.word-item').dataset.id;
			if (id) {
				await this.openForEdit(id);
			}
		}
	}

	_onSearch() {
		const query = this._inputSearch.value.trim().toLowerCase();

		// Если поле поиска пустое — просто рендерим все слова из кэша
		if (!query) {
			this.renderList(this._cachedWords);
			return;
		}

		// Фильтруем массив: ищем совпадение в термине, переводе или названии категории
		const filteredWords = this._cachedWords.filter(word => {
			return (
				word.term.toLowerCase().includes(query) ||
				word.hint.toLowerCase().includes(query) ||
				word.category.toLowerCase().includes(query)
			);
		});

		// Отрисовываем только совпавшие слова
		this.renderList(filteredWords);
	}
}
