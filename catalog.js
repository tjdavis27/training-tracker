window.TRAINING_CATALOG = (() => {
  const check = (id,label,group='Checklist') => ({id,label,group});
  const quiz = (id,label,group='Quizzes') => ({id,label,group});
  const room = (id,label,short,color,opts={}) => ({id,label,short,color,...opts});

  const generalRh1Checks = [
    check('rh1.every.password','Knows the host computer password','Opening'),
    check('rh1.every.cluebyopen','Knows Clueby needs to be open','Opening'),
    check('rh1.every.walkie','Knows to equip a walkie talkie','Opening'),

    check('rh1.every.timing','Understands room timing / where groups should be','Room Running'),
    check('rh1.every.ahead','Knows how to handle groups that are ahead','Room Running'),
    check('rh1.every.behind','Knows how to handle groups that are behind','Room Running'),
    check('rh1.every.repeatplayers','Knows how to identify / handle repeat players','Room Running'),
    check('rh1.every.guessing','Knows what to do if a group guesses into something','Room Running'),
    check('rh1.every.issue','Knows what to do if something does not work as expected','Room Running'),
    check('rh1.every.specialclues','Knows the procedure for special clues','Room Running'),

    check('rh1.every.tvaudio','Can work the viewing-room TV / audio','Pre-Room'),
    check('rh1.every.engage','Knows how to engage with groups before the room','Pre-Room'),

    check('rh1.every.ekphoto','Can update Escape Kit info and upload photos','Post-Room'),
    check('rh1.every.leaderboard','Knows when to uncheck Leaderboard in Escape Kit','Post-Room'),
    check('rh1.every.closeexperience','Knows how to close out the guest experience','Post-Room'),
    check('rh1.every.lobbyprocedure','Knows the room-to-lobby / photo procedure','Post-Room'),

    check('rh1.every.shutdown','Knows to completely shut down the host computer','Closing'),
    check('rh1.every.closingchecklist','Knows to use the closing checklist','Closing'),

    check('rh1.every.startwristband','Knows to use a wristband to start time','Remote Start / Stop'),
    check('rh1.every.stopwristband','Knows to use a wristband to stop time','Remote Start / Stop'),
    check('rh1.every.twentyminutes','Knows Clueby cannot stop time before 20 minutes','Remote Start / Stop'),
    check('rh1.every.stopbackup','Knows how to stop time if the keypad / wristband process fails','Remote Start / Stop'),

    check('rh1.every.difficulty','Can explain room difficulty using suspense / teamwork / brain power','Miscellaneous'),
    check('rh1.every.quality','Knows what to check for room quality control','Miscellaneous'),
    check('rh1.every.backups','Knows where to find backups','Miscellaneous'),
    check('rh1.every.jobflow','Understands the overall flow of the Room Host job','Miscellaneous'),
    check('rh1.every.cxscomm','Uses the walkie to communicate with CXS','Miscellaneous'),
    check('rh1.every.capacity','Knows how many people each room holds','Miscellaneous'),
    check('rh1.every.resetupload','Can upload the reset checklist to Slack','Miscellaneous')
  ];

  const roomSimple = {
    a8: [
      check('rh1.a8.opened','Opened Atlas 8 solo','Milestones'),
      check('rh1.a8.closed','Closed Atlas 8 solo','Milestones'),
      check('rh1.a8.doublecheck','Double checked Atlas 8','Milestones'),
      check('rh1.a8.soundcheck','Completed Atlas 8 sound check','Milestones'),
      check('rh1.a8.triplecheck','Triple checked Atlas 8 without a mistake','Milestones'),
      check('rh1.a8.override','Knows what the override button does and how to use it','Room Knowledge'),
      check('rh1.a8.battery','Can correctly reset the battery','Room Knowledge'),
      check('rh1.a8.nameoverlay','Can reset the name overlay compartment so it pops','Room Knowledge'),
      check('rh1.a8.numberoverlays','Can set up the number overlays correctly','Room Knowledge'),
      check('rh1.a8.planets','Can point out the four planets indicated by the number overlays','Room Knowledge'),
      check('rh1.a8.manifest','Can identify the name-overlay names on the ship manifest','Room Knowledge')
    ],
    esp: [
      check('rh1.esp.opened','Opened Espionage solo','Milestones'),
      check('rh1.esp.closed','Closed Espionage solo','Milestones'),
      check('rh1.esp.doublecheck','Double checked Espionage','Milestones'),
      check('rh1.esp.soundcheck','Completed Espionage sound check','Milestones'),
      check('rh1.esp.triplecheck','Triple checked Espionage without a mistake','Milestones'),
      check('rh1.esp.handcuffkey','Knows when to remove the handcuff key','Room Knowledge'),
      check('rh1.esp.handcuffs','Can handcuff groups safely / not too tight','Room Knowledge'),
      check('rh1.esp.magnetclues','Knows special clues for the magnet maze','Room Knowledge'),
      check('rh1.esp.lostkey','Knows procedure if the group loses the key','Room Knowledge'),
      check('rh1.esp.letters','Knows where the magnetic letters are','Room Knowledge')
    ],
    ftf: [
      check('rh1.ftf.opened','Opened Fairytale Frenzy solo','Milestones'),
      check('rh1.ftf.closed','Closed Fairytale Frenzy solo','Milestones'),
      check('rh1.ftf.doublecheck','Double checked Fairytale Frenzy','Milestones'),
      check('rh1.ftf.soundcheck','Completed Fairytale Frenzy sound check','Milestones'),
      check('rh1.ftf.triplecheck','Triple checked Fairytale Frenzy without a mistake','Milestones'),
      check('rh1.ftf.directional','Can demonstrate the directional lock','Room Knowledge'),
      check('rh1.ftf.egghatch','Can reliably enter the wall code to open the egg hatch','Room Knowledge'),
      check('rh1.ftf.wolfy','Can easily explain the WOLFY puzzle','Room Knowledge'),
      check('rh1.ftf.pinocchio','Can explain the Pinocchio puzzle logic','Room Knowledge'),
      check('rh1.ftf.henchman','Can explain the henchman puzzle logic','Room Knowledge')
    ],
    bb: [
      check('bb.doublecheck','Double checked Biohazard Bunker','Milestones'),
      check('bb.soundcheck','Completed Biohazard Bunker sound check','Milestones'),
      check('bb.tree','Knows how to override the tree door','Room Knowledge'),
      check('bb.locker','Knows how to override the locker door','Room Knowledge'),
      check('bb.tubes','Knows how to override the test tube puzzle','Room Knowledge'),
      check('bb.morse','Can reliably enter the Morse code','Room Knowledge'),
      check('bb.resetbuttons','Knows where the reset buttons are and how to use them','Room Knowledge')
    ]
  };

  const roomQuizzes = (prefix,label) => [
    quiz(`${prefix}.overview`,`${label} Room Overview`),
    quiz(`${prefix}.clue`,`${label} Clue Quiz`),
    quiz(`${prefix}.issue`,`${label} Room Issue / Reset Error Quiz`)
  ];

  const roles = [
    {
      id:'rh1', label:'RH1', subtitle:'Atlas 8 · Espionage · Fairytale Frenzy', color:'lavender',
      clearanceId:'clear.rh1',
      roomTabs:[
        room('every','Every Room','ALL','green',{
          simple:generalRh1Checks,
          quizzes:[
            quiz('rh1.general.policy','Policy Quiz'),
            quiz('rh1.general.clueby','Clueby Quiz'),
            quiz('rh1.general.basics','Room Host Basics Quiz')
          ]
        }),
        room('a8','Atlas 8','A8','lavender',{simple:roomSimple.a8,observations:['Intro','Outro','Room Run'],resetTarget:5,quizzes:roomQuizzes('rh1.a8','Atlas 8'),clearanceId:'clear.a8'}),
        room('esp','Espionage','ESP','rose',{simple:roomSimple.esp,observations:['Intro','Outro','Room Run'],resetTarget:5,quizzes:roomQuizzes('rh1.esp','Espionage'),clearanceId:'clear.esp'}),
        room('ftf','Fairytale Frenzy','FTF','gold',{simple:roomSimple.ftf,observations:['Intro','Outro','Room Run'],resetTarget:5,quizzes:roomQuizzes('rh1.ftf','Fairytale Frenzy'),clearanceId:'clear.ftf'})
      ]
    },
    {
      id:'bb', label:'BB', subtitle:'Biohazard Bunker', color:'blue', clearanceId:'clear.bb',
      singleRoom:room('bb','Biohazard Bunker','BB','blue',{simple:roomSimple.bb,observations:['Intro','Outro','Room Run'],resetTarget:5,quizzes:roomQuizzes('bb','Biohazard Bunker'),clearanceId:'clear.bb'})
    },
    {
      id:'cxs1', label:'CXS-1', subtitle:'Customer Experience Specialist 1', color:'green', clearanceId:'clear.cxs1',
      simple:[],
      quizzes:[
        quiz('cxs1.basics','Basics Quiz'),
        quiz('cxs1.policy','Policy Quiz'),
        quiz('cxs1.phone','Phone Call Quiz'),
        quiz('cxs1.faq','FAQ Quiz'),
        quiz('cxs1.escapekit','Escape Kit Quiz'),
        quiz('cxs1.test','CXS-1 Test')
      ]
    },
    {
      id:'cxs2', label:'CXS-2', subtitle:'Customer Experience Specialist 2', color:'purple', clearanceId:'clear.cxs2',
      simple:[],
      quizzes:[
        quiz('cxs2.square','Square Quiz'),
        quiz('cxs2.bookeo','Bookeo Quiz'),
        quiz('cxs2.policy','Policies / Troubleshooting Quiz'),
        quiz('cxs2.test','CXS-2 Test')
      ]
    },
    {
      id:'cxs3', label:'CXS-3', subtitle:'Customer Experience Specialist 3', color:'pink', clearanceId:'clear.cxs3',
      simple:[],
      quizzes:[
        quiz('cxs3.invoice','Invoices Quiz'),
        quiz('cxs3.emails','Emails Quiz'),
        quiz('cxs3.scarcity','Scarcity Blocks Quiz'),
        quiz('cxs3.test','CXS-3 Test')
      ]
    }
  ];

  const roleMap = new Map(roles.map(x=>[x.id,x]));
  const simpleMap = new Map();
  const quizMap = new Map();
  roles.forEach(role=>{
    (role.simple||[]).forEach(x=>simpleMap.set(x.id,{...x,role:role.id}));
    (role.quizzes||[]).forEach(x=>quizMap.set(x.id,{...x,role:role.id}));
    const roomList=role.roomTabs||[role.singleRoom].filter(Boolean);
    roomList.forEach(r=>{
      (r.simple||[]).forEach(x=>simpleMap.set(x.id,{...x,role:role.id,room:r.id}));
      (r.quizzes||[]).forEach(x=>quizMap.set(x.id,{...x,role:role.id,room:r.id}));
    });
  });

  return {roles,roleMap,simpleMap,quizMap};
})();
