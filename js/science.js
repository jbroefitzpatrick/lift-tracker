// Research behind the plan builder's recommendations. Shown in the app under "Why these numbers".
// Links go to the paper (DOI/PubMed) where known, otherwise to a PubMed title search.

const search = (title) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(title)}`;

export const REFS = {
  tabata1996: {
    cite: 'Tabata I, et al. (1996). Effects of moderate-intensity endurance and high-intensity intermittent training on anaerobic capacity and VO2max. Med Sci Sports Exerc 28(10):1327–1330.',
    finding: '8 × 20 sec all-out with 10 sec rest, 5 days a week for 6 weeks, raised both VO₂max and anaerobic capacity.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/8897392/',
  },
  burgomaster2005: {
    cite: 'Burgomaster KA, et al. (2005). Six sessions of sprint interval training increases muscle oxidative potential and cycle endurance capacity in humans. J Appl Physiol 98(6):1985–1990.',
    finding: '4–7 × 30 sec all-out cycle sprints with 4 min recovery doubled endurance time after just two weeks.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15705728/',
  },
  little2010: {
    cite: 'Little JP, et al. (2010). A practical model of low-volume high-intensity interval training induces mitochondrial biogenesis in human skeletal muscle. J Physiol 588(6):1011–1022.',
    finding: '10 × 60 sec at ~90% of max heart rate with 75 sec recovery gave endurance adaptations similar to much longer sessions.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/20100740/',
  },
  helgerud2007: {
    cite: 'Helgerud J, et al. (2007). Aerobic high-intensity intervals improve VO2max more than moderate training. Med Sci Sports Exerc 39(4):665–671.',
    finding: '4 × 4 min at 90–95% of max heart rate with 3 min active recovery improved VO₂max more than steady moderate running.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/17414804/',
  },
  klika2013: {
    cite: "Klika B, Jordan C (2013). High-intensity circuit training using body weight: maximum results with minimal investment. ACSM's Health Fit J 17(3):8–13.",
    finding: 'A 12-exercise bodyweight circuit (30 sec work, 10 sec transition), alternating body regions, gives an efficient mix of strength and conditioning work.',
    url: search('High-intensity circuit training using body weight maximum results with minimal investment'),
  },
  markovic2007: {
    cite: 'Markovic G (2007). Does plyometric training improve vertical jump height? A meta-analytical review. Br J Sports Med 41(6):349–355.',
    finding: 'Plyometric training reliably improves jump height (roughly 5–8%), using low-rep, high-quality jumps with full recovery.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/17347316/',
  },
  gibala2012: {
    cite: 'Gibala MJ, et al. (2012). Physiological adaptations to low-volume, high-intensity interval training in health and disease. J Physiol 590(5):1077–1084.',
    finding: 'Review: short, hard intervals produce endurance and metabolic adaptations comparable to longer steady training, in less time.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22289907/',
  },
  mifflin1990: {
    cite: 'Mifflin MD, et al. (1990). A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 51(2):241–247.',
    finding: 'The Mifflin-St Jeor equation estimates resting energy use from weight, height, age and sex; it is among the most accurate common equations.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=A+new+predictive+equation+for+resting+energy+expenditure+in+healthy+individuals',
  },
  mcgill2010: {
    cite: 'McGill S (2010). Core training: evidence translating to better performance and injury prevention. Strength Cond J 32(3):33–46.',
    finding: 'Train the trunk to resist movement (anti-extension, anti-rotation, side-bending) as well as to move it; curl-ups, side planks and bird dogs build spine-sparing endurance.',
    url: search('Core training: evidence translating to better performance and injury prevention McGill'),
  },
  hibbs2008: {
    cite: 'Hibbs AE, et al. (2008). Optimizing performance by improving core stability and core strength. Sports Med 38(12):995–1008.',
    finding: 'Core stability (control) and core strength (force) are different qualities; a program should train both, with some loaded work.',
    url: search('Optimizing performance by improving core stability and core strength'),
  },
  granata2008: {
    cite: 'Granata KP, Gottipati P (2008). Fatigue influences the dynamic stability of the torso. Ergonomics 51(8):1258–1271.',
    finding: 'Fatigued trunk muscles made the torso less stable, a reason to save hard core work for after heavy lifting.',
    url: search('Fatigue influences the dynamic stability of the torso'),
  },
  jeffreys2007: {
    cite: 'Jeffreys I (2007). Warm-up revisited: the ramp method of optimising warm-ups. Professional Strength & Conditioning 6:12–18.',
    finding: 'A warm-up in three phases: Raise (temperature and heart rate), Activate and Mobilize (the movements to come), Potentiate (short, specific priming).',
    url: 'https://www.google.com/search?q=Jeffreys+2007+RAMP+warm-up+method',
  },
  mcgowan2015: {
    cite: 'McGowan CJ, et al. (2015). Warm-up strategies for sport and exercise: mechanisms and applications. Sports Med 45(11):1523–1546.',
    finding: 'Active warm-ups that raise muscle temperature and include specific, dynamic movements improve performance; keep them short enough to avoid fatigue.',
    url: search('Warm-up strategies for sport and exercise: mechanisms and applications'),
  },
  rippetoe2011: {
    cite: 'Rippetoe M (2011). Starting Strength: Basic Barbell Training, 3rd ed. The Aasgaard Company.',
    finding: 'Novices can add weight to the main barbell lifts every session for months (linear progression) before needing slower, planned cycles.',
    url: 'https://startingstrength.com/get-started/programs',
  },
  wendler2009: {
    cite: 'Wendler J (2009). 5/3/1: The Simplest and Most Effective Training System to Increase Raw Strength.',
    finding: 'Sub-maximal three-week waves (5s, 3s, 5/3/1) based on 90% of your max, an all-out final set, and small training-max increases each cycle.',
    url: 'https://www.jimwendler.com/blogs/jimwendler-com/101065094-5-3-1-for-a-beginner',
  },
  williams2017: {
    cite: 'Williams TD, et al. (2017). Comparison of periodized and non-periodized resistance training on maximal strength: a meta-analysis. Sports Med 47(10):2083–2100.',
    finding: 'Periodized programs (planned changes in load and reps) produced greater gains in maximal strength than non-periodized ones.',
    url: search('Comparison of periodized and non-periodized resistance training on maximal strength: a meta-analysis'),
  },
  fradkin2010: {
    cite: 'Fradkin AJ, et al. (2010). Effects of warming-up on physical performance: a systematic review with meta-analysis. J Strength Cond Res 24(1):140–148.',
    finding: 'Warming up improved performance in 79% of the criteria examined.',
    url: search('Effects of warming-up on physical performance: a systematic review with meta-analysis'),
  },
  vanhooren2018: {
    cite: 'Van Hooren B, Peake JM (2018). Do we need a cool-down after exercise? Sports Med 48(7):1575–1595.',
    finding: 'An active cool-down does little for next-day soreness or performance, but it is harmless and many people find it helps them wind down.',
    url: search('Do we need a cool-down after exercise? A narrative review'),
  },
  rio2015: {
    cite: 'Rio E, et al. (2015). Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy. Br J Sports Med 49(19):1277–1283.',
    finding: 'Heavy isometric holds reduced patellar tendon pain for at least 45 minutes, which makes them useful before training.',
    url: search('Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy'),
  },
  aaos2017: {
    cite: 'American Academy of Orthopaedic Surgeons. OrthoInfo conditioning programs (shoulder, knee, hip, spine, foot and ankle).',
    finding: 'Standard physical-therapy exercise programs for common problem areas, such as external rotation and scapular work for shoulders and bridges and clamshells for hips.',
    url: 'https://orthoinfo.aaos.org/en/recovery/',
  },
  simao2012: {
    cite: 'Simão R, et al. (2012). Exercise order in resistance training. Sports Med 42(3):251–265.',
    finding: 'Exercises done first in a session are performed best and improve most, so the priority lifts should come first.',
    url: search('Exercise order in resistance training Simão Sports Medicine 2012'),
  },
  fonseca2014: {
    cite: 'Fonseca RM, et al. (2014). Changes in exercises are more effective than in loading schemes to improve muscle strength. J Strength Cond Res 28(11):3085–3092.',
    finding: 'Varying exercises for the same muscle group produced more uniform muscle growth across the quadriceps and good strength gains.',
    url: search('Changes in exercises are more effective than in loading schemes to improve muscle strength'),
  },
  bazvalle2019: {
    cite: 'Baz-Valle E, et al. (2019). The effects of exercise variation in muscle thickness, maximal strength and motivation in resistance trained men. PLoS One 14(12):e0226989.',
    finding: 'Rotating exercises session to session gave similar muscle growth to fixed exercises and higher motivation to train.',
    url: search('The effects of exercise variation in muscle thickness, maximal strength and motivation in resistance trained men'),
  },
  kassiano2022: {
    cite: 'Kassiano W, et al. (2022). Does varying resistance exercises promote superior muscle hypertrophy and strength gains? A systematic review. J Strength Cond Res 36(6):1753–1762.',
    finding: 'Some planned variation can help muscle growth across regions of a muscle, but excessive or random rotation can compromise strength and size gains.',
    url: search('Does varying resistance exercises promote superior muscle hypertrophy and strength gains? A systematic review'),
  },
  laurent2011: {
    cite: 'Laurent CM, et al. (2011). A practical approach to monitoring recovery: development of a perceived recovery status scale. J Strength Cond Res 25(3):620–628.',
    finding: 'A simple self-rating of how recovered you feel tracked actual performance in the next session, so asking is a useful recovery check.',
    url: search('A practical approach to monitoring recovery: development of a perceived recovery status scale'),
  },
  wiewelhove2019: {
    cite: 'Wiewelhove T, et al. (2019). A meta-analysis of the effects of foam rolling on performance and recovery. Front Physiol 10:376.',
    finding: 'Foam rolling after exercise slightly reduced perceived muscle pain and had small benefits for recovery; effects are modest but consistent.',
    url: search('A meta-analysis of the effects of foam rolling on performance and recovery'),
  },
  behm2016: {
    cite: 'Behm DG, et al. (2016). Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review. Appl Physiol Nutr Metab 41(1):1–11.',
    finding: 'Stretching improves range of motion; long static holds right before maximal efforts can blunt performance slightly, so stretch after training or on rest days.',
    url: search('Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals'),
  },
  daniels2014: {
    cite: 'Daniels J (2014). Daniels\' Running Formula, 3rd ed. Human Kinetics.',
    finding: 'Training paces set from a recent race time: easy runs well slower than race pace, threshold (tempo) runs around 1-hour race pace, intervals near 3–5k pace.',
    url: 'https://us.humankinetics.com/products/daniels-running-formula-3rd-edition',
  },
  bickel2011: {
    cite: 'Bickel CS, et al. (2011). Exercise dosing to retain resistance training adaptations in young and older adults. Med Sci Sports Exerc 43(7):1177–1187.',
    finding: 'After building strength, young adults kept their strength and muscle size for 32 weeks on as little as one-third of their previous training volume.',
    url: search('Exercise dosing to retain resistance training adaptations in young and older adults'),
  },
  herrmann2024: {
    cite: 'Herrmann SD, et al. (2024). 2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities. J Sport Health Sci 13(1):6–12.',
    finding: 'Measured energy costs (METs) for 1,114 activities in adults 19–59, e.g. resistance training 3.5 (8–15 reps, varied), 5.0 (heavy squats/deadlifts), 5.8 (circuits with supersets).',
    url: 'https://pacompendium.com/adult-compendium/',
  },
  byrne2005: {
    cite: 'Byrne NM, et al. (2005). Metabolic equivalent: one size does not fit all. J Appl Physiol 99(3):1112–1119.',
    finding: 'The standard 1 MET = 3.5 mL/kg/min overstated measured resting metabolism by about 35% on average; using a person\'s own resting rate improves estimates.',
    url: search('Metabolic equivalent: one size does not fit all Byrne'),
  },
  kozey2010: {
    cite: 'Kozey S, et al. (2010). Errors in MET estimates of physical activities using 3.5 ml·kg−1·min−1 as the baseline oxygen consumption. J Phys Act Health 7(4):508–516.',
    finding: 'Standard METs misestimate activity cost, most for people with higher body fat or older age; correcting to individual resting rate reduces the error.',
    url: search('Errors in MET estimates of physical activities using 3.5 ml kg min as the baseline oxygen consumption'),
  },
  cunningham1991: {
    cite: 'Cunningham JJ (1991). Body composition as a determinant of energy expenditure: a synthetic review and a proposed general prediction equation. Am J Clin Nutr 54(6):963–969.',
    finding: 'Lean (fat-free) mass is the main determinant of resting energy: RMR ≈ 370 + 21.6 × fat-free mass (kg).',
    url: search('Body composition as a determinant of energy expenditure a synthetic review and a proposed general prediction equation'),
  },
  keytel2005: {
    cite: 'Keytel LR, et al. (2005). Prediction of energy expenditure from heart rate monitoring during submaximal exercise. J Sports Sci 23(3):289–297.',
    finding: 'Energy expenditure during exercise predicted from heart rate, weight, age and sex (r ≈ 0.86 without a VO2max test).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15966347/',
  },
  acsm2021: {
    cite: 'American College of Sports Medicine (2021). ACSM\'s Guidelines for Exercise Testing and Prescription, 11th ed. Metabolic calculations.',
    finding: 'Oxygen cost of walking and running from speed: walking VO2 = 0.1 × speed + 3.5, running VO2 = 0.2 × speed + 3.5 (mL/kg/min, speed in m/min, level ground).',
    url: search('ACSM metabolic equations walking running oxygen cost'),
  },
  silbernagel2007: {
    cite: 'Silbernagel KG, et al. (2007). Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy. Am J Sports Med 35(6):897–906.',
    finding: 'Training could continue when pain stayed at or below 5/10 during activity and settled by the next morning; higher or lingering pain meant reducing load.',
    url: search('Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy'),
  },
  manca2017: {
    cite: 'Manca A, et al. (2017). Cross-education of muscular strength following unilateral resistance training: a meta-analysis. Eur J Appl Physiol 117(11):2335–2354.',
    finding: 'Training one limb raised strength in the untrained opposite limb by about 12% (16% in legs), which helps protect strength when one side is hurt.',
    url: search('Cross-education of muscular strength following unilateral resistance training: a meta-analysis'),
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
