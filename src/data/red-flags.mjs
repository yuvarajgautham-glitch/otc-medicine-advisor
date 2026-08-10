/**
 * Red-flag symptom routing.
 *
 * This cannot come from openFDA — drug labels describe what a product treats,
 * never "this person should not be self-treating at all". So it is written by
 * hand and always wins: if a search matches a red flag, we show the referral
 * and suppress the shopping results.
 *
 * Two tiers:
 *   emergency - possible time-critical condition; call 911 / go to the ER
 *   urgent    - not an emergency, but needs a clinician rather than a pharmacy
 *
 * `patterns` are matched against the lower-cased user query as regular
 * expressions. Prefer over-matching here: a false "see a doctor" is a minor
 * annoyance, a false "here's some ibuprofen" is not.
 */

export const RED_FLAGS = [
	// ------------------------------------------------------------- EMERGENCY
	{
		id: 'cardiac',
		tier: 'emergency',
		title: 'Chest pain can be a heart attack',
		advice:
			'Chest pain, pressure or tightness — especially with sweating, nausea, shortness of breath, or pain spreading to the arm, jaw or back — needs emergency care now. Do not wait to see if it passes, and do not drive yourself.',
		patterns: [
			'chest pain', 'chest hurt', 'pain in (my )?chest', 'chest press', 'chest tight',
			'crushing chest', 'heart attack', 'tightness in (my )?chest', 'pressure in (my )?chest',
			'pain in my left arm', 'jaw pain and', 'heart racing and chest',
		],
	},
	{
		id: 'stroke',
		tier: 'emergency',
		title: 'These can be signs of a stroke',
		advice:
			'Sudden weakness or numbness (especially on one side), a drooping face, slurred speech, confusion, sudden vision loss or a sudden severe headache are stroke warning signs. Call 911 immediately — stroke treatment is time-critical and works best within hours.',
		// Stems rather than exact phrases: people write "my speech is slurred"
		// and "my face is drooping", not "slurred speech".
		patterns: [
			'stroke', 'slurr', 'droop', 'numb on one side', 'numbness on one side',
			'weakness on one side', 'one side of my body', 'cant move my arm', "can't move my arm",
			'sudden confusion', 'worst headache', 'thunderclap', 'sudden vision loss',
			'lost vision', 'cant speak', "can't speak", 'words come out wrong',
			'face.{0,15}(droop|numb|weak)', 'arm.{0,15}(went numb|numbness)',
		],
	},
	{
		id: 'breathing',
		tier: 'emergency',
		title: 'Trouble breathing needs emergency care',
		advice:
			'Severe shortness of breath, gasping, blue lips or fingertips, or being unable to speak a full sentence needs emergency care now. Call 911.',
		patterns: [
			'cant breathe', "can't breathe", 'cannot breathe', 'trouble breathing',
			'difficulty breathing', 'struggling to breathe', 'gasping', 'blue lips',
			'short of breath', 'shortness of breath', 'wheezing badly', 'suffocating',
			'asthma attack',
		],
	},
	{
		id: 'anaphylaxis',
		tier: 'emergency',
		title: 'This may be a severe allergic reaction',
		advice:
			'Swelling of the face, lips, tongue or throat, difficulty swallowing, or a widespread rash with dizziness is anaphylaxis until proven otherwise. Use an epinephrine auto-injector if you have one and call 911. Antihistamine tablets are not enough.',
		patterns: [
			'anaphyla', 'epipen',
			// "throat is closing up", "my tongue is swelling", "lips swelled up"
			'throat.{0,12}clos', 'throat.{0,12}swell', 'throat.{0,12}tight',
			'tongue.{0,12}swell', 'lips?.{0,12}swell', 'face.{0,12}swell',
			'swollen (throat|tongue|lips?|face)', 'cant swallow', "can't swallow",
			'trouble swallowing', 'allergic reaction.{0,20}(breath|swell|throat)',
		],
	},
	{
		id: 'bleeding',
		tier: 'emergency',
		title: 'Bleeding like this needs urgent assessment',
		advice:
			'Coughing or vomiting blood, black tarry stools, or bleeding that will not stop needs emergency care. These can signal internal bleeding.',
		patterns: [
			'coughing (up )?blood', 'vomiting blood', 'throwing up blood', 'blood in my vomit',
			'black stool', 'tarry stool', 'blood in my stool', 'bleeding wont stop',
			"bleeding won't stop", 'heavy bleeding', 'blood in urine', 'blood in my pee',
		],
	},
	{
		id: 'mental-health-crisis',
		tier: 'emergency',
		title: 'Please talk to someone right now',
		advice:
			'If you are thinking about harming yourself or ending your life, you deserve real support immediately — not a pharmacy shelf. In the US call or text 988 (Suicide & Crisis Lifeline), available 24/7 and free. If you are in immediate danger, call 911.',
		patterns: [
			'kill myself', 'suicid', 'end my life', 'want to die', 'self harm', 'self-harm',
			'hurt myself', 'no reason to live', 'better off dead', 'overdose on purpose',
		],
	},
	{
		id: 'overdose',
		tier: 'emergency',
		title: 'Possible overdose or poisoning',
		advice:
			'Call Poison Control at 1-800-222-1222 right now (free, 24/7, US), or 911 if the person is unconscious, having a seizure, or not breathing. Have the product package with you if you can.',
		patterns: [
			'overdose', 'took too many', 'took too much', 'swallowed.{0,20}(pill|poison|bleach|chemical)',
			'poisoning', 'poisoned', 'my child ate', 'child swallowed', 'accidentally took',
		],
	},
	{
		id: 'head-injury',
		tier: 'emergency',
		title: 'Head injuries need to be checked',
		advice:
			'After a blow to the head, vomiting, confusion, drowsiness, unequal pupils, a worsening headache or any loss of consciousness needs emergency assessment. Do not take painkillers before being seen — some increase bleeding risk.',
		patterns: [
			'hit my head', 'head injury', 'banged my head', 'concussion', 'knocked out',
			'passed out after', 'fell and hit',
		],
	},
	{
		id: 'seizure',
		tier: 'emergency',
		title: 'Seizures need emergency care',
		advice:
			'A first-time seizure, a seizure lasting more than 5 minutes, or one followed by confusion or trouble breathing is an emergency. Call 911.',
		patterns: ['seizure', 'convulsion', 'fitting', 'having a fit'],
	},
	{
		id: 'severe-abdominal',
		tier: 'emergency',
		title: 'Severe abdominal pain needs assessment',
		advice:
			'Sudden severe stomach pain — especially with fever, a rigid or tender abdomen, or inability to keep fluids down — can mean appendicitis, obstruction or another surgical emergency. Do not take painkillers or laxatives; they can mask or worsen it. Go to urgent care or the ER.',
		patterns: [
			'severe stomach pain', 'severe abdominal', 'worst stomach pain', 'appendicitis',
			'lower right.{0,15}pain', 'stomach is rigid', 'cant keep anything down',
			"can't keep anything down", 'agonizing stomach',
		],
	},
	{
		id: 'infant-fever',
		tier: 'emergency',
		title: 'Fever in a young baby is always urgent',
		advice:
			'A fever of 100.4°F (38°C) or higher in a baby under 3 months needs same-day medical assessment — call your doctor or go to the ER. Do not give any medicine first unless a clinician tells you to.',
		patterns: [
			'newborn fever', 'baby fever', 'infant fever', 'fever.{0,25}(newborn|infant|month old|weeks old)',
			'(newborn|infant|month old|weeks old).{0,25}fever',
		],
	},
	{
		id: 'meningitis',
		tier: 'emergency',
		title: 'This combination can mean meningitis',
		advice:
			'Fever with a stiff neck, severe headache, sensitivity to light, or a rash that does not fade when pressed with a glass needs emergency care immediately.',
		patterns: [
			'stiff neck.{0,25}fever', 'fever.{0,25}stiff neck', 'meningitis',
			'rash.{0,20}doesnt fade', 'sensitive to light.{0,25}headache', 'neck stiffness',
		],
	},

	// ---------------------------------------------------------------- URGENT
	{
		id: 'pregnancy',
		tier: 'urgent',
		title: 'Check with a pharmacist or doctor first',
		advice:
			'Many common OTC medicines — including ibuprofen, aspirin and most decongestants — are not recommended during pregnancy or breastfeeding. Please ask a pharmacist or your midwife or doctor before taking anything, including anything listed on this site.',
		patterns: ['pregnant', 'pregnancy', 'breastfeeding', 'breast feeding', 'nursing', 'expecting a baby'],
	},
	{
		id: 'infection',
		tier: 'urgent',
		title: 'This may need prescription treatment',
		advice:
			'Infections that need antibiotics — such as a suspected bacterial throat infection, a spreading skin infection, or a urinary tract infection — cannot be treated with anything sold over the counter. See a doctor; some pharmacies can also test and treat directly.',
		patterns: [
			'infection', 'infected', 'antibiotic', 'strep throat', 'pus', 'spreading redness',
			'red streaks', 'abscess', 'boil', 'uti', 'urinary tract',
		],
	},
	{
		id: 'persistent',
		tier: 'urgent',
		title: 'Symptoms lasting this long should be checked',
		advice:
			'Over-the-counter medicines are meant for short-term relief. Anything lasting more than about 7–10 days, or that keeps coming back, should be looked at by a clinician rather than managed with repeat purchases.',
		patterns: [
			'for (weeks|months|years)', 'weeks now', 'months now', 'wont go away', "won't go away",
			'keeps coming back', 'chronic', 'for a month', 'never goes away', 'all the time',
		],
	},
	{
		id: 'unexplained-systemic',
		tier: 'urgent',
		title: 'These symptoms need investigating, not treating',
		advice:
			'Unexplained weight loss, night sweats, a lump, persistent fatigue, or a mole that is changing are signals to get assessed rather than self-treat. They are usually benign — but they are not something a pharmacy product should paper over.',
		patterns: [
			'losing weight', 'weight loss', 'night sweats', 'lump', 'swollen gland', 'growing mole',
			'mole.{0,20}chang', 'always tired', 'exhausted all the time', 'fainting', 'passing out',
		],
	},
	{
		id: 'child-dosing',
		tier: 'urgent',
		title: 'Doses for young children are different',
		advice:
			'Dosing for children is by weight and age, and several common medicines — including aspirin and most cough and cold products — are unsafe under certain ages. Ask a pharmacist or paediatrician for the correct product and dose. Nothing on this page should be given to a child without that check.',
		patterns: [
			'my (child|kid|son|daughter|baby|toddler)', 'for a (child|kid|baby|toddler)',
			'\\d+ year old', '\\d+ month old', 'my newborn', 'for kids', 'for children',
		],
	},
	{
		id: 'mental-health',
		tier: 'urgent',
		title: 'This deserves proper support',
		advice:
			'Depression, anxiety and panic are real, treatable medical conditions — and there is no effective over-the-counter treatment for them. Talking to a doctor is genuinely worth it. In the US you can also call or text 988 any time to talk to someone.',
		patterns: [
			'depress', 'anxiety', 'anxious', 'panic attack', 'cant cope', "can't cope",
			'mental health', 'hopeless', 'crying all the time',
		],
	},
	{
		id: 'eye-injury',
		tier: 'urgent',
		title: 'Eye symptoms need in-person assessment',
		advice:
			'Eye pain, sudden vision changes, light sensitivity, or something stuck in the eye should be seen by a doctor or optometrist the same day. Do not use redness-relief drops to mask it.',
		patterns: [
			'eye injury', 'something in my eye', 'eye pain', 'vision blurry', 'blurred vision',
			'seeing double', 'flashes of light', 'floaters',
		],
	},
	{
		id: 'diabetes-bp',
		tier: 'urgent',
		title: 'Ongoing conditions need medical management',
		advice:
			'Diabetes, high blood pressure, thyroid and heart conditions cannot be managed with over-the-counter products — and several OTC medicines (decongestants and NSAIDs in particular) can interfere with them. Please speak to your doctor or pharmacist.',
		patterns: [
			'diabetes', 'diabetic', 'blood sugar', 'high blood pressure', 'hypertension',
			'blood pressure', 'thyroid', 'heart failure', 'kidney disease', 'liver disease',
		],
	},
];

/**
 * Match a free-text query against the red-flag list.
 * Returns matches sorted so that emergencies come first.
 */
export function matchRedFlags(query) {
	const q = ` ${String(query).toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ')} `;
	const hits = [];
	for (const flag of RED_FLAGS) {
		if (flag.patterns.some((p) => new RegExp(p).test(q))) hits.push(flag);
	}
	return hits.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'emergency' ? -1 : 1));
}
