
export class CategoriesPage {
	constructor(firebaseService) {
		this.fb = firebaseService;

		this._el = document.getElementById('screen-categories');
		this._input = this._el.querySelector('.category-form input');
		this._btnSubmit = this._el.querySelector('.category-form button');
		this._listContainer = this._el.querySelector('.categories-list');

		this._bind();
	}

	_bind() {
		this._btnSubmit.addEventListener('click', this._onAddCategory.bind(this));

		this._input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') this._onAddCategory();
		});

		this._listContainer.addEventListener('click', this._onListClick.bind(this));
	}

	async render() {
		this._listContainer.innerHTML = '<li>Загрузка...</li>';

		try {
			const categories = await this.fb.getCategories();
			this._listContainer.innerHTML = '';

			if (categories.length === 0) {
				this._listContainer.innerHTML = '<li>Категорий еще нет!</li>';
				return;
			}

			const template = document.getElementById('category-item');

			categories.forEach(cat => {
				const fragment = template.content.cloneNode(true);
				const row = fragment.querySelector('.category-item');

				row.dataset.id = cat.id;
				row.querySelector('.category-item__name').innerText = cat.name;

				this._listContainer.appendChild(fragment);
			});
		} catch (err) {
			console.error(err);
			this._listContainer.innerHTML = '<li>Ошибка загрузки данных</li>';
		}
	}

	async _onAddCategory() {
		const name = this._input.value.trim();
		if (!name) return;

		this._btnSubmit.disabled = true;
		try {
			await this.fb.addCategory(name);
			this._input.value = '';
			await this.render();
		} catch (err) {
			alert('Не удалось сохранить категорию');
		} finally {
			this._btnSubmit.disabled = false;
		}
	}

	// src/CategoriesPage.js

	async _onListClick(e) {
		const btnDelete = e.target.closest('.btn-delete');
		if (!btnDelete) { return; }

		const id = btnDelete.closest('.category-item').dataset.id;
		if (!id) return;

		// 1. Получаем имя удаляемой категории из HTML-структуры текущей строки
		const categoryName = btnDelete.closest('.category-item').querySelector('.category-item__name').innerText;

		try {
			// 2. Запрашиваем все слова пользователя из Firebase для проверки
			const words = await this.fb.getWords();

			// 3. Ищем, привязано ли хоть одно слово к этой категории
			const hasLinkedWords = words.some(word => word.category === categoryName);

			if (hasLinkedWords) {
				// Если слова найдены — жестко блокируем операцию и прерываем метод
				alert(`Нельзя удалить категорию "${categoryName}", так как в ней есть слова! Сначала удалите или перенесите эти слова в словаре.`);
				return;
			}

			// 4. Если категория пуста — запрашиваем стандартное подтверждение
			if (confirm(`Удалить пустую категорию "${categoryName}"?`)) {
				await this.fb.deleteCategory(id);
				await this.render(); // Обновляем список категорий на экране
			}
		} catch (err) {
			console.error(err);
			alert('Ошибка при проверке связей категории');
		}
	}

}
