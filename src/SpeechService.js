export class SpeechService {
	constructor(lang = 'en-US') {
		this.synth = window.speechSynthesis;
		this.lang = lang;
	}

	// Главный метод для озвучки текста
	speak(text) {
		// Если прямо сейчас что-то озвучивается — прерываем, чтобы звуки не накладывались
		if (this.synth.speaking) {
			this.synth.cancel();
		}

		// Создаем объект запроса на озвучку
		const utterance = new SpeechSynthesisUtterance(text);

		// Устанавливаем язык (например, 'en-US' для американского или 'en-GB' для британского)
		utterance.lang = this.lang;

		// Можно настроить скорость (0.1 до 10) и тональность (0 до 2)
		utterance.rate = 0.9; // Чуть замедлим для лучшего восприятия на слух
		utterance.pitch = 1.0;

		// Запускаем озвучку
		this.synth.speak(utterance);
	}
}