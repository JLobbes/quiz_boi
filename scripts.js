document.addEventListener('DOMContentLoaded', () => {
	const quizzBoiInstance = new QuizzBoi();
	quizzBoiInstance.loadListeners();
});

class QuizzBoi { 
	constructor() {
		this.vocabulary;    // [ { stageOneData: 'word', stageTwoData: 'meaning', stageThreeData: 'secondaryMeaning', sources: ['source sentence', ... ] } , ...]
		this.loadVocabulary();

		this.stats;         // { history: [], currentStreak: 0, highestStreak: 0, last50: 0, overallPercentage: 0, }
		this.loadStats();

		this.currentQuestionData; // { 
								  // 	questiontext: 'text block', 
								  // 	targetWord: { word: 'word', meaning: 'meaning', secondaryMeaning, 'secondaryMeaning' }, 
								  //	stageOneAnswers:    [ 'random word 1', 'random word 2', 'random word 3', 'random word 4' ], 
								  //	stageTwoAnswers: [ 'random meaning 1', 'random meaning 2', 'random meaning 3', 'random meaning 4' ], 
								  //	stageThreeAnswers: [ 'random secondaryMeaning 1', 'random secondaryMeaning 2', 'random secondaryMeaning 3', 'random secondaryMeaning 4' ], 
		this.currentStage = 1;
		this.incorrectEmojis = { 
			index: 0, 
			emojis:['😟','😞','😭'] 
		};

		// Settings
		this.settingUpdateInProgress = false;
		
		this.numOfStages = 3;  // Quantity of stages per given question
		this.loadQuizStageQuantity();
		
		this.hardPinYinOn = false; // Create variations of correct pin yin
		this.loadPinYinMode();

		this.surroundingCharLength = 25;
		this.loadSurroundingCharLength();
		
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

		const setingsBts = document.querySelectorAll('.setting-options label');
		setingsBts.forEach(button => {
			button.addEventListener('click', (event) => {
				this.handleSettingUpdate(button.firstElementChild);
			});
		});

		const clearDataBtns = document.querySelectorAll('.setting-options button');
		clearDataBtns.forEach(button => {
			button.addEventListener('click', (event) => {
				this.handleClearData(button);
			});
		});

		const quizButtons = document.querySelectorAll('.answer-block');
		quizButtons.forEach(button => {
			button.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					this.checkAnswer(button);
				}
			});
			button.addEventListener('click', this.checkAnswer.bind(this, button));
		});
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

			// Prepare format to show user
			let properFormat = `Word`;
			if(this.numOfStages = 2) properFormat += '- Meaning';
			if(this.numOfStages = 3) properFormat += '- Secondary Meaning';

			this.showNotification(`Please enter vocab in correct format (${properFormat})`);
			
			return;
		}

		// Match parsed vocab to the source text submitted
		let emptyMatches = ''; 
		parsedVocab.forEach((vocabWord) => {
			const targetWord = vocabWord['stageOneData'];
			const matches = this.findMatches(targetWord, sourceText);
			if(matches) {
				vocabWord['sources'] = [...matches]; 
			} else {
				emptyMatches = `${emptyMatches} ${targetWord}`;
			}
		})

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
					const [ stageOneData, stageTwoData, stageThreeData ] = parts;
					vocabulary.push({ stageOneData, stageTwoData, stageThreeData });
				}
			}
		});
		
		return vocabulary;
	}

	findMatches(targetWord, sourceText) {
		const regex = new RegExp(`(?:^|[\\s.,;:!?"(){}\\[\\]<>-_])${targetWord}(?:$|[\\s.,;:!?"(){}\\[\\]<>-_])`, 'g');
		const matches = [];
		let match;
	
		// Find all matches and their indexes
		while ((match = regex.exec(sourceText)) !== null) {
			const startIndex = Math.max(match.index - this.surroundingCharLength, 0); // Start index with a minimum of 0
			const endIndex = Math.min(match.index + targetWord.length + this.surroundingCharLength, sourceText.length); // End index within bounds
			const context = sourceText.slice(startIndex, endIndex).replace(/\n/g, '').trim(); // Remove \n and trim
			matches.push(context); 
		}
	
		return matches; 
	}

	// Quiz Logic

	generateQuiz() {
		this.currentStage = 1; // Reset quiz sequence 

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
			targetWord: { stageOneData: 'target word', stageTwoData: 'meaning', stageThreeData: 'secondaryMeaning' }, 
			questionText: 'source text', 
			stageOneAnswers: [], // (4) Possible answers populated inside array
			stageTwoAnswers: [],  // (4) Possible answers populated inside array
			stageThreeAnswers: []  // (4) Possible answers populated inside array
		}
		
		const randomVocab = this.getRandomVocab();
		
		// Choose random source text from possible sources, replace target with blank
		let randomIndex = Math.floor(Math.random() * randomVocab['sources'].length);
		const randomLine = randomVocab['sources'][randomIndex];
		const lineWithBlank = this.blankOutTargetWord(randomLine, randomVocab['stageOneData']);
		this.currentQuestionData['questionText'] = lineWithBlank;
		
		// Update target word information
		this.currentQuestionData['targetWord']['stageOneData'] = randomVocab['stageOneData'];
		this.currentQuestionData['targetWord']['stageTwoData'] = randomVocab['stageTwoData'];
		this.currentQuestionData['targetWord']['stageThreeData'] = randomVocab['stageThreeData'];

		// Insert random answers for all question blocks, all stages
		for (let i = 1; i <= this.numOfStages; i++) {
			
			const stages = {
				1: 'stageOne',
				2: 'stageTwo',
				3: 'stageThree',
			}
			const targetStage = stages[i]; // Turns number into readable string

			for (let i = 0; i < 4; i++) { // Each question block has (4) random answers selected
				this.supplyRandomAnswer(targetStage);
			}

			// One random question block has its answer overwrote with the correct answer
			randomIndex = Math.floor(Math.random() * 4);
			this.currentQuestionData[`${targetStage}Answers`][randomIndex] = this.currentQuestionData['targetWord'][`${targetStage}Data`];
		}

		// console.log(this.currentQuestionData);
	}

	getRandomVocab() {
		const randomIndex = Math.floor(Math.random() * this.vocabulary.length);
	
		return { ...this.vocabulary[randomIndex] }; // Return a shallow copy of the random object
	}

	supplyRandomAnswer(targetStage) {
		let randomAnswer;

		// Prevent infinity draw when there are inadequate # of answers
		let attempts = 0; 
		const maxAttempts = 20; 
	
		do {
			const randomVocab = this.getRandomVocab();
			randomAnswer = randomVocab[`${targetStage}Data`];
	
			if (targetStage === 'stageTwo' && this.hardPinYinOn && this.currentQuestionData.targetWord['stageOneData'].length > 1) {
				try {
					randomAnswer = this.getPlausiblePinyinVariations(this.currentQuestionData['targetWord'][`${targetStage}Data`]);				
					console.log('Hard PinYin:', randomAnswer);
				} catch (error) {
					console.error('Your second stage data include words without pin yin tones. Hard Pin Yin mode must be turned off');
					this.updatePinYinMode('off');
				}
			}
			attempts++;
		} while (
			attempts < maxAttempts &&
			(this.currentQuestionData[`${targetStage}Answers`].includes(randomAnswer) || 
			 this.currentQuestionData['targetWord'][`${targetStage}Data`] === randomAnswer)
		);
	
		if (attempts < maxAttempts) {
			this.currentQuestionData[`${targetStage}Answers`].push(randomAnswer);
		} else {
			this.currentQuestionData[`${targetStage}Answers`].push('...');
			console.warn('Max attempts reached. No new random answer found.');
		}
	}
	
	getPlausiblePinyinVariations(originalPinYin) {
		const toneVariations = {
			'ā': ['á', 'ǎ', 'à', 'ā'],
			'á': ['ā', 'ǎ', 'à', 'á'],
			'ă': ['ā', 'á', 'à', 'ǎ'],
			'ǎ': ['ā', 'á', 'à', 'ǎ'],
			'à': ['ā', 'á', 'ǎ', 'à'],
			'ō': ['ó', 'ǒ', 'ò', 'ō'],
			'ó': ['ō', 'ǒ', 'ò', 'ó'],
			'ǒ': ['ō', 'ó', 'ò', 'ǒ'],
			'ŏ': ['ō', 'ó', 'ò', 'ǒ'],
			'ò': ['ō', 'ó', 'ǒ', 'ò'],
			'ē': ['é', 'ě', 'è', 'ē'],
			'é': ['ē', 'ě', 'è', 'é'],
			'ě': ['ē', 'é', 'è', 'ě'],
			'è': ['ē', 'é', 'ě', 'è'],
			'ī': ['í', 'ĭ', 'ì', 'ī'],
			'í': ['ī', 'ĭ', 'ì', 'í'],
			'ĭ': ['ī', 'í', 'ì', 'ĭ'],
			'ǐ': ['ī', 'í', 'ì', 'ĭ'],
			'ì': ['ī', 'í', 'ĭ', 'ì'],
			'ū': ['ú', 'ǔ', 'ù', 'ū'],
			'ú': ['ū', 'ǔ', 'ù', 'ú'],
			'ǔ': ['ū', 'ú', 'ù', 'ǔ'],
			'ŭ': ['ū', 'ú', 'ù', 'ǔ'],
			'ù': ['ū', 'ú', 'ǔ', 'ù'],
			'ǖ': ['ǘ', 'ǚ', 'ǜ', 'ǖ'],
			'ǘ': ['ǖ', 'ǚ', 'ǜ', 'ǘ'],
			'ǚ': ['ǖ', 'ǘ', 'ǜ', 'ǚ'],
			'ǜ': ['ǖ', 'ǘ', 'ǚ', 'ǜ']
		};
	
		const targetVowels = [];
	
		// Identify and store target vowels
		for (let i = 0; i < originalPinYin.length; i++) {
			const char = originalPinYin[i];
			if (toneVariations[char]) {
				targetVowels.push({ character: char, index: i });
			}
		}
		
		let alteredPinYin = originalPinYin;
	
		// Perform tone swaps
		do {
			for (const vowel of targetVowels) {
				const possibleVariations = toneVariations[vowel.character];
				if (possibleVariations) {
					const newVowel = possibleVariations[Math.floor(Math.random() * possibleVariations.length)];
					alteredPinYin = alteredPinYin.slice(0, vowel.index) + newVowel + alteredPinYin.slice(vowel.index + 1);
				}
			}
		} while (alteredPinYin === originalPinYin);
		
		return alteredPinYin;
	}
	
	blankOutTargetWord(line, targetWord) {
		const regex = new RegExp(`(?:^|[\\s.,;:!?"(){}\\[\\]<>-_])${targetWord}(?:$|[\\s.,;:!?"(){}\\[\\]<>-_])`, 'g');
		return line.replace(regex, '__'); // Replace the target word with blanks
	}

	renderQuiz() {
		this.incorrectEmojis.index = 0; // Reset sad emoji sequence
		
		// The quiz has multiple stages
		// Each section is rendered in sequence, only after the previous stages  is completed.
		const stages = {
			1: 'stageOne',
			2: 'stageTwo',
			3: 'stageThree',
		}
		const currentStage = stages[this.currentStage]; // Turns number into readable string

		const quizFinished = this.currentStage > this.numOfStages; 
		if(quizFinished) {
			this.navigateToNextQuestion(); 
			return;
		}

		const question = document.createElement('p');
		if(currentStage === 'stageOne') {
			question.innerText = this.currentQuestionData['questionText'];
		} else {
			question.innerText = `Select the suitable match for: ${this.currentQuestionData.targetWord['stageOneData']}`
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
			possibleAnswer.innerText = this.currentQuestionData[`${currentStage}Answers`][i];
			block.appendChild(possibleAnswer);
		}
	}

	checkAnswer(targetButton) {

		// The quiz has multiple stages
		// Each section is rendered in sequence, only after the previous stages  is completed.
		const stages = {
			1: 'stageOne',
			2: 'stageTwo',
			3: 'stageThree',
		}
		const currentStage = stages[this.currentStage]; // Turns number into readable string

		// Check for matching answer
		const chosenAnswer = targetButton.innerText;
		const correctAnswer = this.currentQuestionData['targetWord'][`${currentStage}Data`];
		const correct = chosenAnswer === correctAnswer;

		// Remove button and show if correct or incorrect
		if(correct) {
			targetButton.innerHTML = '<p>✅</p>';

			setTimeout(() => {
				// Advance to next quiz stage
				this.currentStage++; // Only advance quiz if correct answer hit.
				this.renderQuiz();
			}, 400);
		} else {
			if(this.incorrectEmojis.index > 2) this.incorrectEmojis.index--;
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
		document.getElementById('questionCountValue').textContent = `${this.stats.history.length}`;

		if(this.stats.highestStreak > 0) {
			const streakCounter = Math.round((this.stats.currentStreak / this.stats.highestStreak) * 100);
			document.getElementById('streakCounter').style.height = `${streakCounter}%`;
		}
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

		const settingsMenu = document.getElementById('settingsMenu');
		settingsMenu.classList.remove('hidden');
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
	
	// Settings Logic

	handleSettingUpdate(button) {
		// this.settingUpdateInProgress logic prevents event bubbling and double calling
		if (this.settingUpdateInProgress) return;
		this.settingUpdateInProgress = true;
	
		if(button.name === 'stageQuantity') this.updateQuizStageQuantity(button.value);
		if(button.name === 'pinYinMode') this.updatePinYinMode(button.value);
		if(button.name === 'surroundingCharLength') this.updateSurroundingCharLength(button.value);
	
		setTimeout(() => {
			this.settingUpdateInProgress = false; // Reset the flag
		}, 300); 
	}

	updateQuizStageQuantity(newQuantity) {
		this.numOfStages = newQuantity;
		this.showNotification(`Quiz Boi now has ${this.numOfStages} stage(s).`);
		this.saveQuizStageQuantity();
	}

	loadQuizStageQuantity() {
		const numOfStages = localStorage.getItem('numOfStages');
		this.numOfStages = numOfStages ? JSON.parse(numOfStages) : 3;
	}

	saveQuizStageQuantity() {
		localStorage.setItem('numOfStages', JSON.stringify(this.numOfStages));
	}

	updatePinYinMode(newMode) {
		this.hardPinYinOn = (newMode === 'on') ? true : false;
		this.showNotification(`Difficult pin yin mode is now ${newMode}.`);
		this.savePinYinMode();
	}

	loadPinYinMode() {
		const hardPinYinOn = localStorage.getItem('hardPinYin');
		this.hardPinYinOn = hardPinYinOn ? JSON.parse(hardPinYinOn) : false;
	}

	savePinYinMode() {
		localStorage.setItem('hardPinYin', JSON.stringify(this.hardPinYinOn));
	}

	updateSurroundingCharLength(newLength) {
		const convertToNum = Number(newLength);
		this.surroundingCharLength = (convertToNum) ? convertToNum : 25;
		this.showNotification(`Surrounding character length is now ${newLength}.`);
		this.saveSurroundingCharLength();
	}

	loadSurroundingCharLength() {
		const surroundingCharLength = localStorage.getItem('surroundingCharacterLength');
		this.surroundingCharLength = surroundingCharLength ? JSON.parse(surroundingCharLength) : 25;
	}

	saveSurroundingCharLength() {
		localStorage.setItem('surroundingCharacterLength', JSON.stringify(this.surroundingCharLength));
	}

	// Clear Data Logic

	handleClearData(button) {
		// this.settingUpdateInProgress logic prevents event bubbling and double calling
		if (this.settingUpdateInProgress) return;
		this.settingUpdateInProgress = true;
	
		if(button.id === 'clearStats') this.deleteSavedStats(button.id);
		if(button.id === 'clearVocabData') this.deleteSavedVocab(button.id);
	
		setTimeout(() => {
			this.settingUpdateInProgress = false; // Reset the flag
		}, 300); 
	}

	deleteSavedStats() {
		localStorage.removeItem('stats', JSON.stringify(this.stats));
		this.stats = [];
		this.loadStats(); // Loads blank stats
		this.showNotification('Stats cleared.');
		this.renderStatistics();
	}
	
	deleteSavedVocab() {
		localStorage.removeItem('vocabulary', JSON.stringify(this.vocabulary));
		this.vocabulary = [];
		this.showNotification('Vocabulary cleared.');
	}

	
}