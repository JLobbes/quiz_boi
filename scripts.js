document.addEventListener('DOMContentLoaded', () => {
	const quizzBoiInstance = new QuizzBoi();
	quizzBoiInstance.loadListeners();
});

class QuizzBoi { 
	constructor() {
		this.vocabulary;    // [ { Chinese: 'Chinese', pinYin: 'pin yin', English: 'English', sources: ['source sentence', ... ] } , ...]
		this.loadVocabulary();

		this.stats;         // { history: [], currentStreak: 0, highestStreak: 0, last50: 0, overallPercentage: 0, }
		this.loadStats();

		this.currentQuestionData; // { questiontext: 'text block', tartgetword: '', chinese: [ 'chinese1', 'chinese2', 'chinese3', 'chinese4' ], pinYin: [ 'pinYin1', 'pinYin2', 'pinYin3', 'pinYin4' ], english: [ 'english1', 'english2', 'english3', 'english4' ]  }
		this.quizStage = { 
			index: 0, 
			stages: ['chinese', 'pinYin', 'english', 'next']
		}; 
		this.incorrectEmojis = { 
			index: 0, 
			emojis:['😟','😞','😭'] 
		};

	}

	loadListeners() { 
		const homeBtn = document.getElementById('backArrow');
		homeBtn.addEventListener('click', this.navigateToMainMenu.bind(this));

		const navToAddDataBtn = document.getElementById('navToAddData');
		navToAddDataBtn.addEventListener('click', this.navigateToAddData.bind(this));

		const inputDataBtn = document.getElementById('inputData');
		inputDataBtn.addEventListener('click', this.handleAddData.bind(this));

		const navToQuizBtn = document.getElementById('navToQuizMe');
		navToQuizBtn.addEventListener('click', this.navigateToQuiz.bind(this));

		const navToNextQuestionBtn = document.getElementById('navToNextQuestion');
		navToNextQuestionBtn.addEventListener('click', this.navigateToQuiz.bind(this));
		
		const navToStats = document.getElementById('navToStats');
		navToStats.addEventListener('click', this.navigateToStats.bind(this));
		
		const navToSettings = document.getElementById('navToSettings');
		navToSettings.addEventListener('click', this.navigateToSettings.bind(this));

		const quizButtons = document.querySelectorAll('.answer-block');
		quizButtons.forEach(button => {
			button.addEventListener('click', this.checkAnswer.bind(this, button));
		})
	}


	// Vocabulary data handling

	loadVocabulary() {
		const savedVocab = localStorage.getItem('vocabulary');
		this.vocabulary = savedVocab ? JSON.parse(savedVocab) : [];
	}

	saveVocabulary() {
		localStorage.setItem('vocabulary', JSON.stringify(this.vocabulary));
	}

	handleAddData() {

		// Get input from form
		const vocabInput = document.getElementById('vocabInput').value;
		const sourceText = document.getElementById('sourceInput').value;

		// Ensure form has input
		if(!sourceText || !vocabInput) {
			this.showNotification('Please enter data in both boxes');
			return;
		}

		// Parse vocabulary by "-", store in new array
		const parsedVocab = this.parseVocabulary(vocabInput); //  Does not yet contain example sentences
		if(parsedVocab.length < 1) {
			this.showNotification(`Please enter vocab in correct format (Chinese - PinYin - English)`);
			return;
		}

		// Match parsed vocab to the source text submitted
		let emptyMatches = ''; 
		parsedVocab.forEach((vocabWord) => {
			const targetWord = vocabWord['chinese'];
			const matches = this.findMatches(targetWord, sourceText);
			if(matches) {
				vocabWord['sources'] = [...matches]; 
			} else {
				emptyMatches = `${emptyMatches} ${targetWord}`;
			}
		})
		if(emptyMatches != '') {
			this.showNotification(`No matches found for ${emptyMatches}`);
		}

		// Filter out vocabWords with no matches
		const filteredVocab = parsedVocab.filter(vocabWord => vocabWord['sources'] && vocabWord['sources'].length > 0);

		// Add new vocab to local storage
		this.vocabulary = this.vocabulary.concat(filteredVocab); 
		this.saveVocabulary();
		this.showNotification(`Vocab data added for ${filteredVocab.length} word(s)`);

		// Reset input forms
		document.getElementById('vocabInput').value = '';
		document.getElementById('sourceInput').value = '';

		// Return to main menu
		this.navigateToMainMenu();
	}

	parseVocabulary(input) {
		const lines = input.trim().split('\n');
		const vocabulary = [];

		lines.forEach(line => {
			line = line.trim();
			if (line) {
				const parts = line.split(' - ').map(part => part.trim());
				if (parts.length === 3) {
					const [chinese, pinYin, english] = parts;
					vocabulary.push({ chinese, pinYin, english });
				}
			}
		});

		return vocabulary;
	}

	findMatches(targetWord, sourceText) {
		const regex = new RegExp(targetWord, 'g'); 
		const matches = [];
		let match;
	
		// Find all matches and their indexes
		while ((match = regex.exec(sourceText)) !== null) {
			const startIndex = Math.max(match.index - 25, 0); // Start index with a minimum of 0
			const endIndex = Math.min(match.index + targetWord.length + 25, sourceText.length); // End index within bounds
			const context = sourceText.slice(startIndex, endIndex).replace(/\n/g, '').trim(); // Remove \n and trim
			matches.push(context); 
		}
	
		return matches; 
	}

	// Quiz Logic

	generateQuiz() {
		this.quizStage.index = 0; // Reset quiz sequence 

		if(this.vocabulary.length < 1) {
			this.showNotification('Please add vocab data to begin quizzing.');
			this.navigateToMainMenu();
			return;
		}

		this.generateQuestion();
		this.renderQuiz();		
	}
	
	generateQuestion() {
		this.currentQuestionData = { 
			targetWord: { chinese: 'target word', pinYin: 'pinYin', english: 'english' }, 
			questionText: 'source text', 
			chinese: [], // (4) Possible answers populated inside array
			pinYin: [],  // (4) Possible answers populated inside array
			english: []  // (4) Possible answers populated inside array
		}
		
		const randomVocab = this.getRandomVocab();
		
		// Choose random source text from possible sources, replace target with blank
		let randomIndex = Math.floor(Math.random() * randomVocab['sources'].length);
		const randomLine = randomVocab['sources'][randomIndex];
		const lineWithBlank = this.blankOutTargetWord(randomLine, randomVocab['chinese']);
		this.currentQuestionData['questionText'] = lineWithBlank;
		
		// Update target word information
		this.currentQuestionData['targetWord']['chinese'] = randomVocab['chinese'];
		this.currentQuestionData['targetWord']['pinYin'] = randomVocab['pinYin'];
		this.currentQuestionData['targetWord']['english'] = randomVocab['english'];

		// Insert random answers for all blocks, all stages
		// Randomly select Chinese answers from vocab bank as incorrect answers
		for (let i = 0; i < 4; i++) {
			let randomAnswer;
			do {
				const randomVocab = this.getRandomVocab();
				randomAnswer = randomVocab['chinese'];

			} while (
				// Check for duplicate answers and re-draw if present
				this.currentQuestionData['chinese'].includes(randomAnswer) 
				||
				this.currentQuestionData['targetWord']['chinese'] === randomAnswer
			);
			this.currentQuestionData['chinese'].push(randomAnswer);
		}

		// Add plausible incorrect pin yin to answer possibilities
		for (let i = 0; i < 4; i++) {
			let plausibleVariation;
			do {
				plausibleVariation = this.getPlausiblePinyinVariations(this.currentQuestionData.targetWord['pinYin']);
			} while (
				this.currentQuestionData['pinYin'].includes(plausibleVariation)
				||
				this.currentQuestionData.targetWord['pinYin'] === plausibleVariation
			);
			this.currentQuestionData['pinYin'].push(plausibleVariation);
		}

		// Randomly select English answers from vocab bank as incorrect answers
		for (let i = 0; i < 4; i++) {
			let randomAnswer;
			do {
				const randomVocab = this.getRandomVocab();
				randomAnswer = randomVocab['english'];

			} while (
				// Check for duplicate answers and re-draw if present
				this.currentQuestionData['english'].includes(randomAnswer) 
				||
				this.currentQuestionData['targetWord']['english'] === randomAnswer
			);
			this.currentQuestionData['english'].push(randomAnswer);
		}

		// Randomly insert correct answers into questionData options
		randomIndex = Math.floor(Math.random() * 4);
		this.currentQuestionData['chinese'][randomIndex] = this.currentQuestionData['targetWord']['chinese'];
		randomIndex = Math.floor(Math.random() * 4);
		this.currentQuestionData['pinYin'][randomIndex] = this.currentQuestionData['targetWord']['pinYin'];
		randomIndex = Math.floor(Math.random() * 4);
		this.currentQuestionData['english'][randomIndex] = this.currentQuestionData['targetWord']['english'];

		// console.log(this.currentQuestionData);
	}

	getRandomVocab() {
		const randomIndex = Math.floor(Math.random() * this.vocabulary.length);
	
		return { ...this.vocabulary[randomIndex] }; // Return a shallow copy of the random object
	}
	
	getPlausiblePinyinVariations(correctPinyin) {
		let pinyin = correctPinyin;
		const toneMap = {
			'ā': ['á', 'ǎ', 'à'],
			'á': ['ā', 'ǎ', 'à'],
			'ǎ': ['ā', 'á', 'à'],
			'à': ['ā', 'á', 'ǎ'],
			'ō': ['ó', 'ǒ', 'ò'],
			'ó': ['ō', 'ǒ', 'ò'],
			'ǒ': ['ō', 'ó', 'ò'],
			'ò': ['ō', 'ó', 'ǒ'],
			'ē': ['é', 'ě', 'è'],
			'é': ['ē', 'ě', 'è'],
			'ě': ['ē', 'é', 'è'],
			'è': ['ē', 'é', 'ě'],
			'ī': ['í', 'ǐ', 'ì'],
			'í': ['ī', 'ǐ', 'ì'],
			'ǐ': ['ī', 'í', 'ì'],
			'ì': ['ī', 'í', 'ǐ'],
			'ū': ['ú', 'ǔ', 'ù'],
			'ú': ['ū', 'ǔ', 'ù'],
			'ǔ': ['ū', 'ú', 'ù'],
			'ù': ['ū', 'ú', 'ǔ'],
			'ǖ': ['ǘ', 'ǚ', 'ǜ'],
			'ǘ': ['ǖ', 'ǚ', 'ǜ'],
			'ǚ': ['ǖ', 'ǘ', 'ǜ'],
			'ǜ': ['ǖ', 'ǘ', 'ǚ']
		};
	
		let vowelPositions = [];
		let changesLeft = Math.floor(Math.random() * 4) + 1; // 1 to 4 changes
	
		// Identify vowels and their positions
		for (let i = 0; i < pinyin.length; i++) {
			if (toneMap[pinyin[i]]) {
				vowelPositions.push(i);
			}
		}
	
		// Perform tone swaps
		while (changesLeft > 0 && vowelPositions.length > 0) {
			const index = Math.floor(Math.random() * vowelPositions.length);
			const vowelIndex = vowelPositions[index];
			const originalVowel = pinyin[vowelIndex];
			
			if (toneMap[originalVowel]) {
				const possibleVariations = toneMap[originalVowel];
				const newVowel = possibleVariations[Math.floor(Math.random() * possibleVariations.length)];
				pinyin = pinyin.slice(0, vowelIndex) + newVowel + pinyin.slice(vowelIndex + 1);
				changesLeft--;
			}
		}
	
		return pinyin;
	}
	
		

	blankOutTargetWord(line, targetWord) {
		const regex = new RegExp(targetWord, 'g'); // Create a regex for the target word
		return line.replace(regex, '__'); // Replace the target word with blanks
	}

	renderQuiz() {
		this.incorrectEmojis.index = 0; // Reset sad emoji sequence
		
		// The quiz has (3) stages: (i) Chinese, (ii) pin yin, and (iii) English.
		// Each section is rendered in sequence, only after the previous is completed.
		const quizStage = this.quizStage.stages[this.quizStage.index]

		const quizFinished = this.quizStage.index >= 3; 
		if(quizFinished) {
			this.navigateToNextQuestion(); 
			return;
		}

		const question = document.createElement('p');
		if(quizStage === 'chinese') {
			question.innerText = this.currentQuestionData['questionText'];
		} else {
			question.innerText = `${quizStage} for: ${this.currentQuestionData.targetWord['chinese']}`

		}

		const questionBlock = document.getElementById('question');
		questionBlock.innerHTML = '';
		questionBlock.appendChild(question);
		
		const answerBlocks = document.querySelectorAll('.answer-block');
		for (let i = 0; i < answerBlocks.length; i++) {
			const block = answerBlocks[i];
			block.innerHTML = '';

			// Add the approriate text to each answer block
			const possibleAnswer = document.createElement('p');
			possibleAnswer.innerText = this.currentQuestionData[`${quizStage}`][i];
			block.appendChild(possibleAnswer);
		}
	}

	checkAnswer(targetButton) {

		// Check for matching answer
		const chosenAnswer = targetButton.innerText;
		const correctAnswer = this.currentQuestionData['targetWord'][this.quizStage.stages[this.quizStage.index]];
		const correct = chosenAnswer === correctAnswer;

		// Remove button and show if correct or incorrect
		if(correct) {
			targetButton.innerHTML = '<p>✅</p>';

			setTimeout(() => {
				// Advance to next quiz stage
				this.quizStage.index++; // Only advance quiz if correct answer hit.
				this.renderQuiz();
			}, 400);
		} else {
			targetButton.innerHTML = `<p>${this.incorrectEmojis.emojis[this.incorrectEmojis.index]}</p>`
			this.incorrectEmojis.index++;
		}

		this.updateStatistics(correct);
	}


	// Quiz Statistics 

	updateStatistics(correct) {
		if(correct) {
			this.stats.history.unshift('correct');
			this.extendStreak();
			this.calculateLast50();
			this.calculateOverall();
		} else {
			this.stats.history.unshift('wrong');
			this.resetStreak();
			this.calculateLast50();
			this.calculateOverall();
		}
		this.renderStatistics();
		this.saveStats();
	}

	extendStreak() {
		this.stats.currentStreak++;
	
		// Check for milestones
		let milestoneMessage = '';
		if (this.stats.currentStreak === 5) {
			milestoneMessage = '🎉 Congrats! 5 in a row! Keep going!';
		} else if (this.stats.currentStreak === 10) {
			milestoneMessage = '🔥 Awesome! 10 in a row! You’re on fire!';
		} else if (this.stats.currentStreak === 20) {
			milestoneMessage = '🎈 Whoaa.. 20 in a row! Sky\'s the limit.';
		} else if (this.stats.currentStreak === 50) {
			milestoneMessage = '🚀 Incredible! Perfect 50! You’re going to the moon!';
		} else if (this.stats.currentStreak === 75) {
			milestoneMessage = '🍉 Amazing! 75 in a row! Omg!';
		} else if (this.stats.currentStreak === 100) {
			milestoneMessage = '🧙‍♂️ 100 in a row! You’ve reached mythical status!';
		} else if (this.stats.currentStreak === 200) {
			milestoneMessage = '🎊 200 in a row! You are now a quiz master extraordinaire!';
		} else if (this.stats.currentStreak === 300) {
			milestoneMessage = '🐉 300 in a row! Legends will tell tales of your greatness!';
		} else if (this.stats.currentStreak === 500) {
			milestoneMessage = '🦋 500 in a row! Are you even human?';
		} else if (this.stats.currentStreak === 1000) {
			milestoneMessage = '🌈 1000 in a row! You are enlightened! Experiment with mistakes.';
		} else if (this.stats.currentStreak === 2000) {
			milestoneMessage = '🦙 2000 in a row! Go make some friends.';
		}
	
		// Handle highest streak
		if (this.stats.currentStreak > this.stats.highestStreak) {
			this.stats.highestStreak = this.stats.currentStreak;
			if(milestoneMessage) {
				this.showNotification(milestoneMessage);
			} else {
				this.showNotification(`🐙🍩 New High Streak: ${this.stats.highestStreak}! 🦄🐢`);
			}
		} else {
			this.showNotification(`Current Streak Extended to ... (${this.stats.currentStreak})`);
		}
	}

	resetStreak() {
		this.showNotification(`Streak Reset to ⭕!`);
		this.stats.currentStreak = 0;
	}

	calculateLast50() {
		const last50 = this.stats.history.slice(0, 50); // Get the first 50 elements
		const quantityCorrect = last50.filter(elem => elem === 'correct').length;
		const percentCorrect = Math.round((quantityCorrect / last50.length) * 100); // Calculate the percentage
	
		// Round to the nearest 10
		const roundedPercent = Math.round(percentCorrect);
	
		this.stats.last50 = roundedPercent;
	}

	calculateOverall() {
		const quantityCorrect = this.stats.history.filter(elem => elem === 'correct').length;
		const percentCorrect = Math.round((quantityCorrect / this.stats.history.length) * 100); // Calculate the percentage
	
		// Round to the nearest 10
		const roundedPercent = Math.round(percentCorrect);
	
		this.stats.overallPercentage = roundedPercent;
	}
	
	renderStatistics() {
		document.getElementById('currentStreakValue').textContent = this.stats.currentStreak;
		document.getElementById('highStreakValue').textContent = this.stats.highestStreak;
		document.getElementById('last50Value').textContent = `${this.stats.last50}%`;
		document.getElementById('allTimeValue').textContent = `${this.stats.overallPercentage}%`;
	}
	
	loadStats() {
		const blankStats = {
			history: [],
			currentStreak: 0,
			highestStreak: 0,
			last50: 0,
			overallPercentage: 0,
		}

		const savedStats = localStorage.getItem('stats');
		this.stats = savedStats ? JSON.parse(savedStats) : blankStats;

		this.renderStatistics();
	}

	saveStats() {
		localStorage.setItem('stats', JSON.stringify(this.stats));
	}


	// UI Navigation

	navigateToAddData() {
		this.hideAllMenus();
		this.showReturnHomeBtn();

		const addDataMenu = document.getElementById('addDataMenu');
		addDataMenu.classList.remove('hidden');
	}

	navigateToMainMenu() {
		this.hideAllMenus();
		this.hideReturnHomeBtn();

		const mainMenu = document.getElementById('mainMenu');
		mainMenu.classList.remove('hidden');

		const settingsButton = document.getElementById('navToSettings');
		settingsButton.classList.remove('hidden');
	}

	navigateToQuiz() {
		this.hideAllMenus();
		this.showReturnHomeBtn();

		const quizMenu = document.getElementById('quizMenu');
		quizMenu.classList.remove('hidden');

		this.generateQuiz();
	}
	
	navigateToNextQuestion() {
		// This leads to the next question menu, NOT the next question
		this.hideAllMenus();
		this.showReturnHomeBtn();

		const nextQuestionMenu = document.getElementById('nextQuestionMenu');
		nextQuestionMenu.classList.remove('hidden');
	}

	navigateToStats() {
		this.hideAllMenus();
		this.showReturnHomeBtn();

		const statsMenu = document.getElementById('statsMenu');
		statsMenu.classList.remove('hidden');
	}

	navigateToSettings() {
		this.hideAllMenus();
		this.showReturnHomeBtn();
	}

	hideAllMenus() {
		const menus = document.querySelectorAll('.menuWrapper');
		menus.forEach(menu => {
			menu.classList.add('hidden');
		});

		const settingsButton = document.getElementById('navToSettings');
		settingsButton.classList.add('hidden');
	}

	showReturnHomeBtn() {
		const homeBtn = document.getElementById('backArrow');
		homeBtn.classList.remove('hidden');
	};

	hideReturnHomeBtn() {
		const homeBtn = document.getElementById('backArrow');
		homeBtn.classList.add('hidden');
	};


	// Communication Logic
	
	showNotification(message) {
		const notificationBar = document.getElementById('notificationBar');
		notificationBar.innerHTML = '';

		const notification = document.createElement('p');
		notification.textContent = message;

		notification.classList.add('notification');
		notificationBar.appendChild(notification);

		// Remove notification after animation ends
		notification.addEventListener('animationend', () => {
			notificationBar.removeChild(notification);
		});
	}
	
}