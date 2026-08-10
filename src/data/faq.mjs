/**
 * General safety questions.
 *
 * The emergency and doctor-referral questions are not here — those are
 * generated from red-flags.mjs so the FAQ and the live search warnings can
 * never drift apart.
 */

export const GENERAL_FAQ = [
	{
		q: 'Is this site medical advice?',
		a: 'No. It is an information tool. It cannot examine you, does not know your medical history, and cannot tell you what is wrong. It shows you what FDA labels say about medicines you can buy without a prescription. Deciding whether one of them is right for you is a judgement it is not able to make.',
	},
	{
		q: 'Do you track our data?',
		a: 'No. We do not track you, and no data is collected. This is a generic information site with no accounts, no logins, no analytics, no advertising and no cookies. What you type into the search box never leaves your browser — the medicine index is downloaded to your device and all searching happens there, so we could not see your searches even if we wanted to. Nothing you enter is stored, logged, sold or shared with anyone.',
	},
	{
		q: 'When should I see a doctor instead of buying something?',
		a: 'Over-the-counter medicine is designed for mild, short-lived problems that get better on their own. See a doctor if a symptom has lasted more than about a week, keeps coming back, is getting worse rather than better, is severe, or is not something you recognise. Anything in the emergency list needs care immediately.',
	},
	{
		q: 'Why does the site sometimes refuse to show me medicines?',
		a: 'Because for some searches, no over-the-counter product is the right answer, and showing one would be actively harmful. If your search suggests a heart attack, a stroke, breathing difficulty, a severe allergic reaction, poisoning or thoughts of self-harm, we hide the results and show you how to get real help instead. You can still override it, but you should not need to.',
	},
	{
		q: 'How do I avoid accidentally taking too much?',
		a: 'Check the active ingredient, not the brand name. Acetaminophen (paracetamol) is in a great many combination cold and flu products, so taking one of those alongside a separate acetaminophen painkiller is one of the most common causes of accidental overdose — and it damages the liver, sometimes with no early warning symptoms. Read the "active ingredients" box on the back of every packet you take.',
	},
	{
		q: 'Is more medicine better if it is not working?',
		a: 'No. Doses on the label are the maximum that is safe, not a suggestion. For most over-the-counter painkillers the gap between the effective dose and the harmful one is smaller than people assume. If the labelled dose is not touching your symptom, that is a reason to ask a pharmacist or doctor, not to take more.',
	},
	{
		q: 'Can I take this alongside my other medicines?',
		a: 'This site cannot tell you — it does not know what else you take. Interactions with blood thinners, blood pressure medicines and antidepressants are common and easy to miss, and NSAIDs like ibuprofen and naproxen interact with a lot of things. Tell a pharmacist everything you take, including supplements and herbal products.',
	},
	{
		q: 'Is it safe to give these to my child?',
		a: 'Not without checking. Doses for children are by weight and age, not a scaled-down adult dose. Aspirin should not be given to under-16s, and most cough and cold products are unsuitable for young children entirely. The age filter on the home page hides anything whose label does not state it is suitable, but it is a starting point, not a substitute for asking a pharmacist or paediatrician.',
	},
	{
		q: 'What about pregnancy and breastfeeding?',
		a: 'Check first, every time. Several extremely common medicines — including ibuprofen, aspirin and most decongestants — are not recommended in pregnancy. Ask a pharmacist, midwife or doctor before taking anything at all, including anything listed on this site.',
	},
	{
		q: 'Should I buy the brand name or the store brand?',
		a: 'The store brand, almost always. If the active ingredient and its strength are the same, it is the same medicine. Compare the "active ingredients" box rather than the packaging, and you will often pay a fraction of the price for an identical product.',
	},
	{
		q: 'Do I need an appointment to ask a pharmacist?',
		a: 'No, and this is the most underused advice in the whole subject. Pharmacists are medicines experts, they are free to talk to, and you can simply walk in and ask. Five minutes with one beats any amount of searching — including on this site.',
	},
	{
		q: 'How current is the information here?',
		a: 'The catalog re-pulls itself from the FDA whenever it is more than 30 days old, so it refreshes roughly monthly without anyone having to remember. The exact date and time of the last pull is shown at the top of the About the data page. Each medicine page also shows the version date of the specific label it is quoting and links to the live official record on DailyMed, which is always the authoritative version.',
	},
];
