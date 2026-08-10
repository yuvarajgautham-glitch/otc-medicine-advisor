/**
 * Symptom taxonomy.
 *
 * openFDA label text is legal labelling, not the language people type into a
 * search box. Someone with a blocked nose types "stuffy nose"; the label says
 * "nasal congestion". This file bridges the two.
 *
 * Each symptom has:
 *   id       - stable slug
 *   label    - how we show it to the user
 *   group    - for grouping chips in the UI
 *   query    - words a *user* might type (matched against their search input)
 *   label_re - patterns found in openFDA `purpose` / `indications_and_usage`
 *              text, used at build time to tag which medicines treat it
 */

export const SYMPTOM_GROUPS = [
	{ id: 'pain', label: 'Pain & fever' },
	{ id: 'cold', label: 'Cold, flu & allergy' },
	{ id: 'digestive', label: 'Stomach & digestion' },
	{ id: 'skin', label: 'Skin' },
	{ id: 'eye-ear-mouth', label: 'Eyes, ears & mouth' },
	{ id: 'sleep', label: 'Sleep & alertness' },
	{ id: 'other', label: 'Other' },
];

export const SYMPTOMS = [
	// ---------------------------------------------------------------- pain
	{
		id: 'headache',
		label: 'Headache',
		group: 'pain',
		query: ['headache', 'head ache', 'head hurts', 'my head hurts', 'head pain', 'migraine', 'head pounding', 'throbbing head'],
		label_re: ['headache', 'migraine'],
	},
	{
		id: 'fever',
		label: 'Fever',
		group: 'pain',
		query: ['fever', 'temperature', 'high temperature', 'feverish', 'hot', 'chills', 'burning up', 'running a temp'],
		// "hay fever" is an allergy and "fever blister" is a cold sore - neither
		// is a fever. Suppress this symptom when the query only mentions those.
		negate: ['hay fever', 'fever blister'],
		label_re: ['(?<!hay )\\bfevers?\\b(?! blister)', 'reduces fever', 'fever reducer'],
	},
	{
		id: 'muscle-ache',
		label: 'Muscle aches & body aches',
		group: 'pain',
		query: ['muscle ache', 'body ache', 'sore muscles', 'aching', 'aches', 'sore body', 'muscle pain', 'body hurts', 'sore all over'],
		label_re: ['muscular ache', 'muscle ache', 'minor aches and pains', 'body aches'],
	},
	{
		id: 'back-pain',
		label: 'Back pain',
		group: 'pain',
		query: ['back pain', 'backache', 'back hurts', 'sore back', 'lower back pain'],
		label_re: ['backache', 'back pain'],
	},
	{
		id: 'joint-pain',
		label: 'Joint & arthritis pain',
		group: 'pain',
		query: ['joint pain', 'arthritis', 'stiff joints', 'knee pain', 'achy joints', 'sore joints'],
		label_re: ['arthritis', 'joint pain', 'minor pain of arthritis'],
	},
	{
		id: 'toothache',
		label: 'Toothache',
		group: 'pain',
		query: ['toothache', 'tooth pain', 'tooth hurts', 'dental pain', 'teething', 'sore tooth'],
		label_re: ['toothache', 'teething', 'tooth pain'],
	},
	{
		id: 'menstrual-cramps',
		label: 'Period cramps',
		group: 'pain',
		query: ['period pain', 'menstrual cramps', 'cramps', 'period cramps', 'pms', 'time of the month', 'menstrual pain'],
		label_re: ['menstrual cramp', 'menstrual pain', 'premenstrual'],
	},
	{
		id: 'sprain-strain',
		label: 'Sprains, strains & bruises',
		group: 'pain',
		query: ['sprain', 'strain', 'bruise', 'pulled muscle', 'twisted ankle', 'sports injury'],
		label_re: ['sprain', 'strain', 'bruise'],
	},

	// ---------------------------------------------------- cold / flu / allergy
	{
		id: 'nasal-congestion',
		label: 'Stuffy / blocked nose',
		group: 'cold',
		query: ['stuffy nose', 'blocked nose', 'congestion', 'congested', 'nasal congestion', 'cant breathe through nose', 'sinus pressure', 'blocked sinuses'],
		label_re: ['nasal congestion', 'stuffy nose', 'sinus congestion', 'nasal decongestant'],
	},
	{
		id: 'runny-nose',
		label: 'Runny nose & sneezing',
		group: 'cold',
		query: ['runny nose', 'sneezing', 'nose running', 'drippy nose', 'sniffles'],
		label_re: ['runny nose', 'sneezing', 'rhinorrhea'],
	},
	{
		id: 'cough',
		label: 'Cough',
		group: 'cold',
		query: ['cough', 'coughing', 'dry cough', 'chesty cough', 'hacking cough', 'cant stop coughing'],
		label_re: ['cough', 'cough suppressant', 'antitussive'],
	},
	{
		id: 'chest-congestion',
		label: 'Chest congestion & mucus',
		group: 'cold',
		query: ['chest congestion', 'mucus', 'phlegm', 'chesty', 'bringing up phlegm', 'rattly chest'],
		label_re: ['expectorant', 'loosens phlegm', 'thins.{0,20}mucus', 'chest congestion', 'bronchial secretions'],
	},
	{
		id: 'sore-throat',
		label: 'Sore throat',
		group: 'cold',
		query: ['sore throat', 'throat pain', 'scratchy throat', 'throat hurts', 'painful swallowing', 'strep'],
		label_re: ['sore throat', 'sore mouth and throat', 'pharyngitis'],
	},
	{
		id: 'allergies',
		label: 'Allergies & hay fever',
		group: 'cold',
		query: ['allergies', 'hay fever', 'pollen', 'allergic', 'seasonal allergies', 'allergy', 'itchy watery eyes', 'dust allergy'],
		label_re: ['hay fever', 'upper respiratory allergies', 'allergic rhinitis', 'antihistamine'],
	},
	{
		id: 'flu',
		label: 'Cold & flu symptoms',
		group: 'cold',
		query: ['flu', 'cold', 'common cold', 'influenza', 'man flu', 'coming down with something', 'under the weather'],
		label_re: ['common cold', '\\bflu\\b', '\\binfluenza\\b'],
	},

	// ------------------------------------------------------------- digestive
	{
		id: 'heartburn',
		label: 'Heartburn & acid reflux',
		group: 'digestive',
		query: ['heartburn', 'acid reflux', 'acid', 'indigestion', 'burning chest after eating', 'reflux', 'sour stomach', 'gerd'],
		label_re: ['heartburn', 'acid indigestion', 'sour stomach', 'antacid', 'acid reducer'],
	},
	{
		id: 'nausea',
		label: 'Nausea & vomiting',
		group: 'digestive',
		query: ['nausea', 'nauseous', 'feel sick', 'vomiting', 'throwing up', 'queasy', 'sick to my stomach', 'motion sickness', 'travel sickness', 'car sick', 'sea sick'],
		label_re: ['nausea', 'vomiting', 'motion sickness', 'upset stomach associated with'],
	},
	{
		id: 'diarrhea',
		label: 'Diarrhea',
		group: 'digestive',
		query: ['diarrhea', 'diarrhoea', 'loose stools', 'runny stomach', 'the runs', 'upset tummy', 'loose motion'],
		label_re: ['diarrhea', 'antidiarrheal', 'loose stools'],
	},
	{
		id: 'constipation',
		label: 'Constipation',
		group: 'digestive',
		query: ['constipation', 'constipated', 'cant poop', 'blocked up', 'hard stools', 'not going to the toilet', 'irregularity'],
		label_re: ['constipation', 'laxative', 'stool softener', 'bowel movement'],
	},
	{
		id: 'gas-bloating',
		label: 'Gas & bloating',
		group: 'digestive',
		query: ['gas', 'bloating', 'bloated', 'wind', 'trapped gas', 'flatulence', 'gassy', 'stomach pressure'],
		label_re: ['antigas', 'anti-gas', 'bloating', 'gas', 'flatulence'],
	},
	{
		id: 'upset-stomach',
		label: 'Upset stomach',
		group: 'digestive',
		query: ['upset stomach', 'stomach ache', 'tummy ache', 'stomach hurts', 'bad stomach', 'indigestion'],
		label_re: ['upset stomach', 'indigestion', 'stomach discomfort'],
	},
	{
		id: 'hemorrhoids',
		label: 'Hemorrhoids',
		group: 'digestive',
		query: ['hemorrhoids', 'haemorrhoids', 'piles', 'anal itching', 'painful bowel movements'],
		label_re: ['hemorrhoid', 'anorectal'],
	},

	// ------------------------------------------------------------------ skin
	{
		id: 'itching-rash',
		label: 'Itching & rashes',
		group: 'skin',
		query: ['itchy skin', 'itching', 'rash', 'hives', 'eczema', 'itchy rash', 'skin irritation', 'poison ivy', 'bug bite', 'insect bite'],
		label_re: ['itching', 'itchy skin', 'rash', 'insect bites', 'poison ivy', 'anti-itch', 'minor skin irritation'],
	},
	{
		id: 'dry-skin',
		label: 'Dry & cracked skin',
		group: 'skin',
		query: ['dry skin', 'cracked skin', 'chapped', 'flaky skin', 'rough skin'],
		label_re: ['dry skin', 'chapped', 'cracked skin', 'skin protectant'],
	},
	{
		id: 'acne',
		label: 'Acne',
		group: 'skin',
		query: ['acne', 'pimples', 'spots', 'breakout', 'zits', 'blackheads'],
		label_re: ['acne', 'pimples', 'blackheads'],
	},
	{
		id: 'fungal-skin',
		label: 'Athlete’s foot & fungal infections',
		group: 'skin',
		query: ['athletes foot', 'ringworm', 'jock itch', 'fungal infection', 'foot fungus', 'toenail fungus', 'yeast infection'],
		label_re: ['athlete.s foot', 'ringworm', 'jock itch', 'tinea', 'antifungal', 'vaginal yeast'],
	},
	{
		id: 'cuts-scrapes',
		label: 'Cuts, scrapes & burns',
		group: 'skin',
		query: ['cut', 'scrape', 'graze', 'minor burn', 'wound', 'sunburn', 'blister', 'first aid'],
		label_re: ['minor cuts', 'scrapes', 'minor burns', 'first aid antiseptic', 'sunburn'],
	},
	{
		id: 'cold-sore',
		label: 'Cold sores',
		group: 'skin',
		query: ['cold sore', 'fever blister', 'lip sore', 'herpes labialis'],
		label_re: ['cold sore', 'fever blister'],
	},
	{
		id: 'wart',
		label: 'Warts, corns & calluses',
		group: 'skin',
		query: ['wart', 'verruca', 'corn', 'callus', 'hard skin on foot'],
		label_re: ['\\bwarts?\\b', '\\bcorns\\b', '\\bcalluses\\b'],
	},
	{
		id: 'dandruff',
		label: 'Dandruff & scalp itch',
		group: 'skin',
		query: ['dandruff', 'flaky scalp', 'itchy scalp', 'seborrheic dermatitis'],
		label_re: ['dandruff', 'seborrheic dermatitis'],
	},

	// -------------------------------------------------------- eye / ear / mouth
	{
		id: 'dry-eyes',
		label: 'Dry or irritated eyes',
		group: 'eye-ear-mouth',
		query: ['dry eyes', 'itchy eyes', 'red eyes', 'irritated eyes', 'watery eyes', 'eye strain', 'sore eyes'],
		label_re: ['dry eye', 'eye lubricant', 'lubricant eye', 'eye irritation', 'redness of the eye', 'ophthalmic'],
	},
	{
		id: 'earache',
		label: 'Earache & earwax',
		group: 'eye-ear-mouth',
		query: ['earache', 'ear pain', 'ear hurts', 'earwax', 'blocked ear', 'swimmers ear'],
		label_re: ['earwax', 'ear.{0,10}wax', 'swimmer.s ear', 'otic'],
	},
	{
		id: 'mouth-sore',
		label: 'Mouth sores & gum pain',
		group: 'eye-ear-mouth',
		query: ['mouth ulcer', 'canker sore', 'mouth sore', 'gum pain', 'sore gums', 'denture pain'],
		label_re: ['canker sore', 'mouth sore', 'sore gums', 'oral discomfort'],
	},

	// ----------------------------------------------------------------- sleep
	{
		id: 'insomnia',
		label: 'Trouble sleeping',
		group: 'sleep',
		query: ['cant sleep', 'insomnia', 'trouble sleeping', 'sleepless', 'sleep aid', 'wide awake at night', 'restless nights'],
		label_re: ['sleep aid', 'difficulty falling asleep', 'sleeplessness', 'nighttime sleep'],
	},
	{
		id: 'drowsiness',
		label: 'Drowsiness & fatigue',
		group: 'sleep',
		query: ['tired', 'sleepy', 'drowsy', 'fatigue', 'no energy', 'need to stay awake', 'exhausted'],
		label_re: ['restore mental alertness', 'wakefulness', 'drowsiness'],
	},

	// ----------------------------------------------------------------- other
	{
		id: 'smoking',
		label: 'Quitting smoking',
		group: 'other',
		query: ['quit smoking', 'stop smoking', 'nicotine craving', 'cigarette cravings', 'giving up smoking'],
		label_re: ['quit smoking', 'stop smoking', 'nicotine withdrawal', 'smoking cessation'],
	},
	{
		id: 'hair-loss',
		label: 'Hair loss',
		group: 'other',
		query: ['hair loss', 'balding', 'thinning hair', 'receding hairline'],
		label_re: ['hair loss', 'hair regrowth', 'androgenetic alopecia'],
	},
	{
		id: 'uti',
		label: 'Urinary discomfort',
		group: 'other',
		query: ['uti', 'burning when peeing', 'urinary tract infection', 'painful urination', 'bladder infection'],
		label_re: ['urinary', 'urinary tract'],
	},
	{
		id: 'motion-sickness',
		label: 'Motion sickness',
		group: 'other',
		query: ['motion sickness', 'travel sickness', 'car sickness', 'seasickness', 'airsick'],
		label_re: ['motion sickness', 'travel sickness'],
	},
];

/**
 * Categories of OTC product that are not "medicine for a symptom" and would
 * otherwise flood the catalog. openFDA classes sunscreen, toothpaste, hand
 * sanitiser and antiperspirant as HUMAN OTC DRUG.
 */
export const EXCLUDED_PURPOSE_PATTERNS = [
	'sunscreen',
	'antiperspirant',
	'anticaries',
	'anti-caries',
	'antigingivitis',
	'antiplaque',
	'hand sanitizer',
	'skin cleanser',
	'antibacterial soap',
	'hand wash',
	'deodorant',
];

export const EXCLUDED_NAME_PATTERNS = [
	'hand sanitizer',
	'sunscreen',
	'sunblock',
	'toothpaste',
	'antiperspirant',
	'deodorant',
	'mouthwash',
	'body wash',
	'shampoo and conditioner',
	'lip balm spf',
];

/**
 * Some manufacturers file a marketing name in openFDA's `generic_name` field,
 * so "Cough Drops Cherry" arrives looking like an active ingredient. Flavour
 * and pack-variant wording is the giveaway; the genuine ingredient (menthol,
 * benzocaine) is always in the catalog under its own name anyway.
 */
export const MARKETING_NAME_PATTERNS = [
	'cherry', 'berry', 'grape', 'lemon', 'honey', 'orange', 'vanilla', 'mint flavor',
	'flavored', 'flavour', 'flavor', 'talc free', 'value size', 'max strength',
	'maximum strength', 'extra strength', 'non drowsy', 'childrens', 'infants',
	'cough drops', 'sugar free', 'day time', 'night time', 'daytime', 'nighttime',
];

/** Fast lookup: symptom id -> symptom */
export const SYMPTOM_BY_ID = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s]));
