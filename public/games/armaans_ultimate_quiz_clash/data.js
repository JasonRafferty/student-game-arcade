const A='assets/players/';
// Player data and custom ratings for Armaan's game.
const players={
  bronze:[
    ['Harry Maguire',79,'CB','England','Manchester United','harry-maguire.jpg'],
    ['Patrick Dorgu',76,'LWB','Denmark','Manchester United','patrick-dorgu.jpg'],
    ['Diogo Dalot',79,'RB','Portugal','Manchester United','diogo-dalot.jpg'],
    ['Leny Yoro',79,'CB','France','Manchester United','leny-yoro.jpg'],
    ['Emiliano Martínez',79,'GK','Argentina','Aston Villa','emiliano-martinez.jpg'],
    ['Olivier Giroud',79,'ST','France','Lille','olivier-giroud.jpg'],
    ['Thiago Silva',79,'CB','Brazil','Fluminense','thiago-silva.jpg'],
    ['Keylor Navas',79,'GK','Costa Rica','Newell’s Old Boys','keylor-navas.jpg']
  ],
  silver:[
    ['Kobbie Mainoo',82,'CM','England','Manchester United','kobbie-mainoo.jpg'],
    ['Bryan Mbeumo',84,'RW','Cameroon','Manchester United','bryan-mbeumo.jpg'],
    ['Eberechi Eze',84,'CAM','England','Arsenal','eberechi-eze.jpg'],
    ['Phil Foden',84,'CAM','England','Manchester City','phil-foden.jpg'],
    ['Amad Diallo',83,'RW','Côte d’Ivoire','Manchester United','amad-diallo.jpg'],
    ['Lisandro Martínez',84,'CB','Argentina','Manchester United','lisandro-martinez.jpg'],
    ['Benjamin Šeško',84,'ST','Slovenia','Manchester United','benjamin-sesko.jpg'],
    ['Reece James',83,'RB','England','Chelsea','reece-james.jpg'],
    ['Julián Álvarez',84,'ST','Argentina','Atlético Madrid','julian-alvarez.jpg'],
    ['Achraf Hakimi',84,'RB','Morocco','Paris Saint-Germain','achraf-hakimi.jpg'],
    ['Pedri',84,'CM','Spain','Barcelona','pedri.jpg'],
    ['Gabriel Martinelli',83,'LW','Brazil','Arsenal','gabriel-martinelli.jpg'],
    ['Enzo Fernández',84,'CM','Argentina','Chelsea','enzo-fernandez.jpg']
  ],
  gold:[
    ['Matheus Cunha',85,'CAM','Brazil','Manchester United','matheus-cunha.jpg'],
    ['Declan Rice',87,'CDM','England','Arsenal','declan-rice.jpg'],
    ['Cole Palmer',88,'CAM','England','Chelsea','cole-palmer.jpg'],
    ['Virgil van Dijk',89,'CB','Netherlands','Liverpool','virgil-van-dijk.jpg'],
    ['Gabriel Magalhães',87,'CB','Brazil','Arsenal','gabriel-magalhaes.jpg'],
    ['Sandro Tonali',86,'CM','Italy','Newcastle United','sandro-tonali.jpg'],
    ['Rúben Dias',88,'CB','Portugal','Manchester City','ruben-dias.jpg'],
    ['Joško Gvardiol',86,'CB','Croatia','Manchester City','josko-gvardiol.jpg'],
    ['William Saliba',87,'CB','France','Arsenal','william-saliba.jpg'],
    ['Jude Bellingham',89,'CM','England','Real Madrid','jude-bellingham.jpg'],
    ['Antoine Griezmann',88,'ST','France','Atlético Madrid','antoine-griezmann.jpg'],
    ['Luka Modrić',87,'CM','Croatia','Real Madrid','luka-modric.jpg'],
    ['Alisson',89,'GK','Brazil','Liverpool','alisson.jpg'],
    ['Thibaut Courtois',88,'GK','Belgium','Real Madrid','thibaut-courtois.jpg'],
    ['Vinícius Júnior',89,'LW','Brazil','Real Madrid','vinicius-junior.jpg']
  ],
  myth:[
    ['Bruno Fernandes',91,'CAM','Portugal','Manchester United','bruno-fernandes.jpg'],
    ['Bukayo Saka',90,'RW','England','Arsenal','bukayo-saka.jpg'],
    ['Mohamed Salah',92,'RW','Egypt','Liverpool','mohamed-salah.jpg'],
    ['Erling Haaland',92,'ST','Norway','Manchester City','erling-haaland.jpg'],
    ['Martin Ødegaard',90,'CAM','Norway','Arsenal','martin-degaard.jpg'],
    ['Lionel Messi',93,'RW','Argentina','Inter Miami','lionel-messi.jpg'],
    ['Kylian Mbappé',93,'ST','France','Real Madrid','kylian-mbappe.jpg'],
    ['Cristiano Ronaldo',90,'ST','Portugal','Al Nassr','cristiano-ronaldo.jpg'],
    ['Neymar',90,'LW','Brazil','Santos','neymar.jpg'],
    ['Kevin De Bruyne',91,'CM','Belgium','Napoli','kevin-de-bruyne.jpg']
  ]
};

const maths=[['What is 12 × 8?',['86','96','104','88'],1],['What is 3/4 of 40?',['20','30','35','25'],1],['A shop has 125 stickers. It sells 47. How many are left?',['68','72','78','82'],2],['Which number is prime?',['21','29','39','49'],1],['What is 2.5 + 1.75?',['4.25','3.25','4.15','5.25'],0],['What is 15% of 200?',['15','20','30','35'],2],['A rectangle is 9cm by 6cm. What is its area?',['15cm²','30cm²','54cm²','45cm²'],2]];
const english=[['Choose the correct spelling:',['definately','definitely','definatly','definetly'],1],['Which word is an adjective?',['quickly','happiness','brave','jump'],2],['Which sentence uses a comma correctly?',['After lunch we played football.','After lunch, we played football.','After, lunch we played football.','After lunch we, played football.'],1],['What is the antonym of “ancient”?',['old','historic','modern','past'],2],['Which is a metaphor?',['The wind howled like a wolf.','The classroom was a zoo.','The cat ran quickly.','The sky is blue.'],1],['Choose the correct word: “Their / There / They’re going to win.”',['Their','There','They’re','Thier'],2],['What is the verb in “The goalkeeper saved the shot”?',['goalkeeper','saved','the','shot'],1]];
maths.push(['Work this out using written multiplication: 36 × 24 = ?',['764','864','824','944'],1],['Work this out using written division: 864 ÷ 12 = ?',['62','72','82','92'],1],['What is 7.2 × 6?',['42.2','43.2','43.8','42.6'],1],['What is 5/8 of 96?',['48','56','60','64'],2],['Round 6,749 to the nearest hundred.',['6,700','6,800','6,750','6,600'],0],['What is 0.35 as a percentage?',['3.5%','35%','350%','0.35%'],1],['A train travels 180 miles in 3 hours. What is its average speed?',['50 mph','55 mph','60 mph','65 mph'],2],['What is 25% of £84?',['£19','£20','£21','£24'],2],['Calculate 1,204 − 687.',['507','517','527','537'],1],['What is 9²?',['18','72','81','99'],2],['Find the missing number: □ × 14 = 196.',['12','13','14','15'],2],['A football pitch is 105m long and 68m wide. What is its perimeter?',['173m','210m','346m','7,140m'],2],['What is 3.75 + 2.6?',['6.25','6.35','6.45','5.35'],1],['Write 0.6 as a fraction in its simplest form.',['1/6','3/5','6/10','2/3'],1],['What is the ratio 18:6 simplified?',['2:1','3:1','4:1','6:3'],1]);
english.push(['Which sentence is in the past perfect tense?',['I ran home.','I had run home.','I am running home.','I will run home.'],1],['Choose the correct homophone: “Please ___ the door.”',['close','clothes','cloze','clows'],0],['What is the prefix in “unhappy”?',['happy','un','unh','py'],1],['Which word is a synonym for “enormous”?',['tiny','huge','quiet','angry'],1],['Which punctuation shows possession in “Armaan’s ball”?',['comma','apostrophe','colon','semicolon'],1],['Choose the subordinating conjunction.',['because','and','but','or'],0],['Which sentence contains a relative clause?',['The boy who scored smiled.','The boy scored.','Score the goal!','What a goal!'],0],['Which word is an adverb?',['dangerous','danger','dangerously','dare'],2],['Which is a formal phrase?',['Cheers!','I would be grateful if…','No way!','See you!'],1],['What is the plural of “analysis”?',['analysises','analysi','analyses','analysis'],2],['Which sentence uses a semi-colon correctly?',['I packed boots; a ball; and water.','I packed boots; I packed a ball.','I packed boots; because it rained.','I packed; boots.'],1],['Which word is a pronoun?',['stadium','they','fast','celebrate'],1]);

// Build a larger, deterministic bank; all arithmetic answers are calculated.
function numberQuestion(prompt, answer, offsets, written=false) {
  const values=[answer,...offsets.map(n=>Number((answer+n).toFixed(2)))];
  return [prompt, values.map(String), 0, written?'written':'mental'];
}
for(let a=3;a<=12;a++)for(let b=4;b<=12;b++){
  maths.push(numberQuestion('Mental maths: '+a+' × '+b+' = ?',a*b,[a,-b,1]));
}
for(let a=4;a<=20;a++){
  maths.push(numberQuestion('Mental maths: '+(a*12)+' ÷ 12 = ?',a,[2,-2,1]));
  maths.push(numberQuestion('Mental maths: 25% of '+(a*8)+' = ?',a*2,[4,-2,2]));
  maths.push(numberQuestion('Mental maths: '+(a*10+7)+' + 28 = ?',a*10+35,[10,-10,2]));
}
for(let a=12;a<=30;a+=2){
  maths.push(numberQuestion('Use written multiplication: '+(a*13)+' × 7 = ?',a*91,[70,-7,7],true));
  maths.push(numberQuestion('Use written division: '+(a*24)+' ÷ 12 = ?',a*2,[2,-2,4],true));
}
english.push(
 ['Which sentence is in the passive voice?',['The ball was saved by the keeper.','The keeper saved the ball.','Save the ball!','The keeper is saving the ball.'],0],
 ['Which word contains a silent letter?',['knight','goal','team','run'],0],
 ['Which word means the opposite of generous?',['selfish','kind','helpful','friendly'],0],
 ['Which word is a determiner?',['those','quickly','jump','happy'],0],
 ['Choose the correct spelling.',['necessary','neccessary','necesary','neccesary'],0],
 ['Choose the correct spelling.',['accommodate','acommodate','accomodate','acomodate'],0],
 ['Which suffix turns happy into a noun?',['-ness','-ly','-ful','-less'],0],
 ['Which sentence uses a colon to introduce a list?',['Pack these: boots, socks and water.','Pack: these boots are new.','Pack these boots: and socks.','Pack these boots and: socks.'],0],
 ['Which word is a modal verb?',['might','ran','football','quiet'],0],
 ['Which sentence is a command?',['Pass the ball.','Did you pass the ball?','I passed the ball.','What a pass!'],0],
 ['Which word is a conjunction?',['although','happy','slowly','stadium'],0],
 ['Which pair of words are synonyms?',['rapid and swift','bright and dark','early and late','tiny and huge'],0],
 ['Which sentence uses an apostrophe for a missing letter?',['They are sure it won’t rain.','The player’s boots are red.','Armaan’s team won.','The girls’ coach arrived.'],0],
 ['Which sentence uses the subjunctive form?',['If I were captain, I would help.','I was captain last week.','I am captain today.','I will be captain tomorrow.'],0],
 ['Choose the correct word: The team celebrated ___ victory.',['their','there','they’re','thier'],0],
 ['Which word is a noun?',['confidence','confident','confidently','confide'],0]
);
