import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, deleteDoc } from "firebase/firestore";

export class FirebaseService {
	constructor(config) {
		this.app = initializeApp(config);
		this.auth = getAuth(this.app);
		this.db = getFirestore(this.app);
		this.user = null;
	}

	async loginWithGoogle() {
		try {
			const googleProvider = new GoogleAuthProvider();

			const result = await signInWithPopup(this.auth, googleProvider);
			this.user = result.user;

			return this.user;
		} catch (error) {
			console.error("Ошибка авторизации через Google:", error.message);
			throw error;
		}
	}

	async logout() {
		await signOut(this.auth);
		this.user = null;
	}

	onAuthChange(callback) {
		onAuthStateChanged(this.auth, (user) => {
			this.user = user;
			callback(user);
		});
	}

	async addCategory(name) {
		if (!this.user) throw new Error("Пользователь не авторизован");
		try {
			const docRef = await addDoc(collection(this.db, "categories"), {
				name: name,
				createdAt: new Date().toISOString()
			});

			return docRef.id;
		} catch (error) {
			console.error("Ошибка при добавлении категории:", error);
			throw error;
		}
	}

	async getCategories() {
		if (!this.user) throw new Error("Пользователь не авторизован");
		try {
			const q = query(collection(this.db, "categories"));
			const querySnapshot = await getDocs(q);

			const categories = [];
			querySnapshot.forEach((doc) => {
				categories.push({ id: doc.id, ...doc.data() });
			});

			return categories.sort((a, b) => a.name.localeCompare(b.name));
		} catch (error) {
			console.error("Ошибка при получении категорий:", error);
			throw error;
		}
	}

	async deleteCategory(id) {
		if (!this.user) throw new Error("Пользователь не авторизован");

		try {
			await deleteDoc(doc(this.db, "categories", id));
		} catch (error) {
			console.error("Ошибка при удалении категории:", error);
			throw error;
		}
	}

	async addWord(wordData) {
		if (!this.user) throw new Error("Пользователь не авторизован");
		try {
			const docRef = await addDoc(collection(this.db, "words"), {
				...wordData,
				createdAt: new Date().toISOString()
			});
			return docRef.id;
		} catch (error) {
			console.error("Ошибка при добавлении слова:", error);
			throw error;
		}
	}

	async getWords() {
		if (!this.user) throw new Error("Пользователь не авторизован");
		try {
			const q = query(collection(this.db, "words"));
			const querySnapshot = await getDocs(q);
			const words = [];
			querySnapshot.forEach((doc) => {
				words.push({ id: doc.id, ...doc.data() });
			});
			return words;
		} catch (error) {
			console.error("Ошибка при получении слов:", error);
			throw error;
		}
	}

	async updateWord(id, updatedData) {
		if (!this.user) throw new Error("Пользователь не авторизован");
		try {
			await updateDoc(doc(this.db, "words", id), updatedData);
		} catch (error) {
			console.error("Ошибка при изменении слова:", error);
			throw error;
		}
	}

	async deleteWord(id) {
		if (!this.user) throw new Error("Пользователь не авторизован");
		try {
			await deleteDoc(doc(this.db, "words", id));
		} catch (error) {
			console.error("Ошибка при удалении слова:", error);
			throw error;
		}
	}

	async updateWordProgress(wordId, updatedFields) {
		if (!this.user) throw new Error("Пользователь не авторизован");

		try {
			const wordDocRef = doc(this.db, "words", wordId);
			await updateDoc(wordDocRef, updatedFields);
		} catch (error) {
			console.error("Ошибка при обновлении слова:", error);
			throw error;
		}
	}
}