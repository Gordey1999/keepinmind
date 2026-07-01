export class Word {
	constructor(term, translation) {
		this.term = term;
		this.translation = translation;
		this.interval = 1; // день до следующего повторения
	}

	getDetails() {
		return `${this.term} — ${this.translation}`;
	}
}