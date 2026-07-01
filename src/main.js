import '@fortawesome/fontawesome-free/css/all.min.css';

import { FirebaseService } from './FirebaseService.js';
import { SpeechService } from './SpeechService.js';
import { Navigation } from './Navigation.js';
import { TrainPage } from './TrainPage.js';
import { WordsPage } from './WordsPage.js';
import { CategoriesPage } from './CategoriesPage.js';

const firebaseConfig = {
	apiKey: "AIzaSyCspUbgk3LB_UR4HlZhlTaiadS3IwIs6AE",
	authDomain: "keepinmind-be076.firebaseapp.com",
	projectId: "keepinmind-be076",
	storageBucket: "keepinmind-be076.firebasestorage.app",
	messagingSenderId: "300975228420",
	appId: "1:300975228420:web:ceaf867a7b7f4c27151751"
};

const fb = new FirebaseService(firebaseConfig);
const speech = new SpeechService('en-US');

const nav = new Navigation();
const trainPage = new TrainPage(fb, speech);
const wordsPage = new WordsPage(fb, nav);
const categoriesPage = new CategoriesPage(fb);


const appWrapper = document.getElementById('app-wrapper');
const authWelcomeScreen = document.getElementById('auth-welcome-screen');
const btnGlobalLogin = document.getElementById('btn-global-login');
const btnLogout = document.querySelector('.btn-logout');

fb.onAuthChange((user) => {
	if (user) {
		appWrapper.classList.remove('--hidden');
		authWelcomeScreen.classList.add('--hidden');

		nav.switchScreen('train');

		categoriesPage.render();
		wordsPage.renderList();
		trainPage.startTraining();
	} else {
		appWrapper.classList.add('--hidden');
		authWelcomeScreen.classList.remove('--hidden');
	}
});

btnGlobalLogin.addEventListener('click', async () => {
	try {
		await fb.loginWithGoogle();
	} catch (err) {
		alert("Не удалось войти: " + err.message);
	}
});

btnLogout.addEventListener('click', async () => {
	if (confirm('Вы уверены, что хотите выйти из аккаунта?')) {
		await fb.logout();
	}
});

nav.onScreenChange((screen) => {
	if (screen === 'train') {
		trainPage.startTraining();
	} else if (screen === 'words') {
		wordsPage.renderList();
	} else if (screen === 'categories') {
		categoriesPage.render();
	}
})
