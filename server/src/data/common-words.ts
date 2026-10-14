/** Mots anglais courants + mots de passe trop fréquents — interdits tels quels. */
export const COMMON_WORDS = new Set(
  `
the be to of and a in that have i it for not on with he as you do at
this but his by from they we say her she or an will my one all would there
their what so up out if about who get which go me when make can like time
no just him know take people into year your good some could them see other
than then now look only come its over think also back after use two how our
work first well way even new want because any these give day most us
password welcome login admin qwerty azerty letmein iloveyou monkey dragon
master sunshine princess football baseball shadow michael jennifer hunter
joshua maggie buster soccer harley batman thomas tigger robert hockey ranger
andrew charlie daniel jordan pepper computer merlin cookie ginger summer
michelle andrews fuckyou whatever baseball1 trustno1 starwars superman
hello world love love123 abc123 123456 12345678 123456789 1234567890
qwerty123 password1 password123 passw0rd admin123 welcome1 letmein1
baseball football1 monkey1 dragon1 master1 login1 princess1
access secret freedom shadow1 sunshine1 princess1 whatever1
computer1 internet google facebook twitter instagram youtube
apple banana orange purple yellow green black white
house music movie happy sad angry beautiful wonderful amazing
friend family school college student teacher doctor
money power heart smile peace dream night light
water fire earth stone river mountain ocean
baby girl boy man woman people
january february march april june july august september october november december
monday tuesday wednesday thursday friday saturday sunday
one two three four five six seven eight nine ten
eleven twelve hundred thousand million
yes no maybe always never today tomorrow yesterday
please thanks sorry hello goodbye welcome
passwordqwerty
changeme default root toor pass test guest
iloveyou1 welcome123 qazwsx zxcvbn asdfgh
pokemon naruto anime minecraft fortnite
chelsea liverpool arsenal manchester
ferrari mustang corvette porsche
coffee pizza burger chocolate cookie1
birthday christmas halloween
beautiful1 lovely sweetheart
fuck shit damn bitch asshole
god jesus christ allah
india london paris tokyo berlin
`.match(/[a-z0-9]+/g) ?? [],
);
