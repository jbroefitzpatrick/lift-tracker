// Research behind the plan builder's recommendations. Shown in the app under "Why these numbers".
// Links go to the paper (DOI/PubMed) where known, otherwise to a PubMed title search.

const search = (title) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(title)}`;

export const REFS = {
  mifflin1990: {
    cite: 'Mifflin MD, et al. (1990). A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 51(2):241–247.',
    finding: 'The Mifflin-St Jeor equation estimates resting energy use from weight, height, age and sex; it is among the most accurate common equations.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=A+new+predictive+equation+for+resting+energy+expenditure+in+healthy+individuals',
  },
  ainsworth2011: {
    cite: 'Ainsworth BE, et al. (2011). 2011 Compendium of Physical Activities: a second update of codes and MET values. Med Sci Sports Exerc 43(8):1575–1581.',
    finding: 'Standard energy costs (METs) for activities — used here to estimate calories burned by lifting and cardio.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=2011+Compendium+of+Physical+Activities+second+update',
  },
  hall2008: {
    cite: 'Hall KD (2008). What is the required energy deficit per unit weight loss? Int J Obes 32(3):573–576.',
    finding: 'The common "3,500 kcal per pound" rule is only a rough approximation; real changes depend on body composition and time.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=What+is+the+required+energy+deficit+per+unit+weight+loss',
  },
  morton2018: {
    cite: 'Morton RW, et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med 52(6):376–384.',
    finding: 'Muscle gains from extra protein plateaued around 1.6 g/kg/day (up to ~2.2 g/kg for some people).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Morton+protein+supplementation+resistance+training+meta-regression+2018',
  },
  jager2017: {
    cite: 'Jäger R, et al. (2017). International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr 14:20.',
    finding: '1.4–2.0 g/kg/day for most exercising people, spread as ~20–40 g doses every 3–4 hours.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=International+Society+of+Sports+Nutrition+Position+Stand+protein+and+exercise+2017',
  },
  helms2014protein: {
    cite: 'Helms ER, et al. (2014). A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab 24(2):127–138.',
    finding: 'During a diet, 2.3–3.1 g/kg of lean mass per day best protects muscle in lean, trained people.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=dietary+protein+during+caloric+restriction+in+resistance+trained+lean+athletes',
  },
  schoenfeld2018meal: {
    cite: 'Schoenfeld BJ, Aragon AA (2018). How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution. J Int Soc Sports Nutr 15:10.',
    finding: 'About 0.4 g/kg per meal across at least four meals (≈1.6 g/kg/day) is a practical way to maximize muscle building.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=How+much+protein+can+the+body+use+in+a+single+meal+for+muscle-building',
  },
  dga2020: {
    cite: 'U.S. Department of Agriculture and U.S. Department of Health and Human Services (2020). Dietary Guidelines for Americans, 2020–2025. 9th ed.',
    finding: 'Fiber: about 14 g per 1,000 kcal eaten.',
    url: 'https://www.dietaryguidelines.gov/',
  },
  peos2019: {
    cite: 'Peos JJ, et al. (2019). Intermittent dieting: theoretical considerations for the athlete. Sports 7(1):22.',
    finding: 'Planned breaks at maintenance during long diets may ease the body’s adaptive response and help adherence; evidence in athletes is still limited.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Intermittent+dieting+theoretical+considerations+for+the+athlete',
  },
  byrne2018: {
    cite: 'Byrne NM, et al. (2018). Intermittent energy restriction improves weight loss efficiency in obese men: the MATADOR study. Int J Obes 42(2):129–138.',
    finding: 'Alternating 2 weeks of dieting with 2 weeks at maintenance produced more fat loss, and better maintenance afterward, than continuous dieting.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=MATADOR+study+intermittent+energy+restriction',
  },
  acsm2009: {
    cite: 'American College of Sports Medicine (2009). Progression models in resistance training for healthy adults. Med Sci Sports Exerc 41(3):687–708.',
    finding: 'Novices: 1–3 sets of 8–12 reps, 2–3 days/week, full body. Intermediate: 3–4 days/week; advanced: 4–6 days with splits. Heavier loads and 2–3+ min rest for strength; moderate loads and 1–2 min for growth; light loads, 10–25 reps and short rest for muscular endurance.',
    url: search('Progression models in resistance training for healthy adults'),
  },
  nsca2016: {
    cite: 'Haff GG, Triplett NT, eds. (2016). Essentials of Strength Training and Conditioning, 4th ed. NSCA / Human Kinetics.',
    finding: 'Load–rep guidelines: strength ≥85% 1RM for ≤6 reps with 2–5 min rest; hypertrophy 67–85% for 6–12 reps; muscular endurance ≤67% for ≥12 reps with ≤30 s rest. Also defines core (multi-joint) vs assistance (single-joint) exercises.',
    url: 'https://www.nsca.com/education/books/essentials-of-strength-training-and-conditioning/',
  },
  schoenfeld2017vol: {
    cite: 'Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 35(11):1073–1082.',
    finding: 'More weekly sets per muscle produced more growth (graded dose-response); roughly 10+ weekly sets per muscle tended to outperform fewer.',
    url: search('Dose-response relationship between weekly resistance training volume and increases in muscle mass'),
  },
  pelland2026: {
    cite: 'Pelland JC, et al. (2026). The resistance training dose-response: meta-regressions exploring the effects of weekly volume and frequency on muscle hypertrophy and strength gain. Sports Med (preprint 2024).',
    finding: '67 studies: growth and strength both rise with weekly volume, with diminishing returns (stronger for strength). Frequency adds strength gains; for growth, total volume matters more than frequency. Counting a set as ½ for secondary muscles fit the data best.',
    url: 'https://sportrxiv.org/index.php/server/preprint/view/460',
  },
  schoenfeld2016freq: {
    cite: 'Schoenfeld BJ, Ogborn D, Krieger JW (2016). Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med 46(11):1689–1697.',
    finding: 'Training each muscle at least twice a week produced more growth than once a week.',
    url: search('Effects of resistance training frequency on measures of muscle hypertrophy'),
  },
  grgic2018freq: {
    cite: 'Grgic J, et al. (2018). Effect of resistance training frequency on gains in muscular strength: a systematic review and meta-analysis. Sports Med 48(5):1207–1220.',
    finding: 'Higher training frequency increased strength gains, largely because it allowed more weekly volume.',
    url: search('Effect of resistance training frequency on gains in muscular strength'),
  },
  schoenfeld2017load: {
    cite: 'Schoenfeld BJ, et al. (2017). Strength and hypertrophy adaptations between low- vs. high-load resistance training. J Strength Cond Res 31(12):3508–3523.',
    finding: 'Growth was similar across heavy and light loads when sets were taken close to failure; maximal strength improved more with heavy loads.',
    url: search('Strength and hypertrophy adaptations between low- vs. high-load resistance training'),
  },
  schoenfeld2016rest: {
    cite: 'Schoenfeld BJ, et al. (2016). Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res 30(7):1805–1812.',
    finding: '3-minute rests produced more strength and growth than 1-minute rests on multi-joint lifts.',
    url: search('Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men'),
  },
  grgic2018rest: {
    cite: 'Grgic J, et al. (2018). Effects of rest interval duration in resistance training on measures of muscular strength. Sports Med 48(1):137–151.',
    finding: 'In trained lifters, rests longer than 2 minutes gave better strength gains.',
    url: search('Effects of rest interval duration in resistance training on measures of muscular strength'),
  },
  refalo2023: {
    cite: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ (2023). Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy. Sports Med 53(3):649–665.',
    finding: 'Training to failure was only trivially better than stopping short; growth may relate to proximity to failure non-linearly, so finishing sets with ~0–3 reps in reserve is enough.',
    url: 'https://doi.org/10.1007/s40279-022-01784-y',
  },
  fragala2019: {
    cite: 'Fragala MS, et al. (2019). Resistance training for older adults: position statement from the NSCA. J Strength Cond Res 33(8):2019–2052.',
    finding: 'Older adults benefit from progressive, multi-set resistance training 2–3 days/week at moderate-to-high effort, with careful progression and extra recovery.',
    url: 'https://doi.org/10.1519/JSC.0000000000003230',
  },
  faigenbaum2009: {
    cite: 'Faigenbaum AD, et al. (2009). Youth resistance training: updated position statement paper from the NSCA. J Strength Cond Res 23(5 Suppl):S60–79.',
    finding: 'Resistance training is safe and effective for youth with qualified supervision and gradual progression; emphasize technique before load.',
    url: search('Youth resistance training: updated position statement paper from the national strength and conditioning association'),
  },
  who2020: {
    cite: 'Bull FC, et al. (2020). WHO guidelines on physical activity and sedentary behaviour. Br J Sports Med 54:1451–1462.',
    finding: 'Adults: 150–300 min/week moderate or 75–150 min vigorous aerobic activity, plus muscle-strengthening on 2+ days/week.',
    url: search('World Health Organization 2020 guidelines on physical activity and sedentary behaviour'),
  },
  garber2011: {
    cite: 'Garber CE, et al. (2011). ACSM position stand: quantity and quality of exercise for developing and maintaining fitness in apparently healthy adults. Med Sci Sports Exerc 43(7):1334–1359.',
    finding: 'Aerobic training ≥5 days/week moderate or ≥3 days vigorous (≥150 or ≥75 min/week); resistance training 2–3 days/week for each major muscle group.',
    url: search('Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness'),
  },
  donnelly2009: {
    cite: 'Donnelly JE, et al. (2009). ACSM position stand: appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults. Med Sci Sports Exerc 41(2):459–471.',
    finding: '150–250 min/week of moderate activity gives modest weight loss; more than 250 min/week is linked to clinically significant loss.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/19127177/',
  },
  willis2012: {
    cite: 'Willis LH, et al. (2012). Effects of aerobic and/or resistance training on body mass and fat mass in overweight or obese adults. J Appl Physiol 113(12):1831–1837.',
    finding: 'Aerobic training reduced fat mass more than resistance training; resistance training added lean mass. Combining both improved body composition most.',
    url: search('Effects of aerobic and/or resistance training on body mass and fat mass in overweight or obese adults'),
  },
  seiler2010: {
    cite: 'Seiler S (2010). What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform 5(3):276–291.',
    finding: 'Successful endurance athletes do roughly 80% of sessions at low intensity and ~20% hard.',
    url: search('What is best practice for training intensity and duration distribution in endurance athletes'),
  },
  ronnestad2014: {
    cite: 'Rønnestad BR, Mujika I (2014). Optimizing strength training for running and cycling endurance performance: a review. Scand J Med Sci Sports 24(4):603–612.',
    finding: 'Heavy strength training (about 4–10RM, multi-joint, ~2 days/week) improves running and cycling economy and performance.',
    url: search('Optimizing strength training for running and cycling endurance performance: A review'),
  },
  schumann2022: {
    cite: 'Schumann M, et al. (2022). Compatibility of concurrent aerobic and strength training for skeletal muscle size and function. Sports Med 52(3):601–612.',
    finding: 'Adding aerobic training did not significantly reduce gains in muscle size or maximal strength; explosive strength was blunted, mainly when both were done in the same session.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/34757594/',
  },
  lundberg2022: {
    cite: 'Lundberg TR, et al. (2022). The effects of concurrent aerobic and strength training on muscle fiber hypertrophy: a systematic review and meta-analysis. Sports Med.',
    finding: 'Concurrent training may slightly blunt fiber growth, possibly more with running than cycling.',
    url: search('The Effects of Concurrent Aerobic and Strength Training on Muscle Fiber Hypertrophy: A Systematic Review and Meta-Analysis'),
  },
  iraki2019: {
    cite: 'Iraki J, Fitschen P, Espinar S, Helms E (2019). Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports 7(7):154.',
    finding: 'When building muscle, gain about 0.25–0.5% of bodyweight per week (lower end for advanced lifters).',
    url: 'https://www.mdpi.com/2075-4663/7/7/154',
  },
  helms2014: {
    cite: 'Helms ER, Aragon AA, Fitschen PJ (2014). Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 11:20.',
    finding: 'When losing fat, about 0.5–1% of bodyweight per week helps preserve muscle.',
    url: search('Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation'),
  },
  bell2022: {
    cite: 'Bell L, et al. (2022). "You can\'t shoot another bullet until you\'ve reloaded the gun": coaches\' perceptions, practices and experiences of deloading in strength and physique sports. Front Sports Act Living 4:1073223.',
    finding: 'Expert coaches typically deload for 5–7 days every 4–6 weeks, mainly by cutting volume and effort. Practice-based, not trial evidence.',
    url: 'https://doi.org/10.3389/fspor.2022.1073223',
  },
};
