
Array.prototype.groupBy = function (selector) { return this
  .reduceRight( ([[xs,...xss], lv], w) => {
      const v = selector(w);
      const x = xs ? [xs,...xss] : [];
      return [lv==v ? [[w,...xs],...xss] : [[w],...x], v];
    }, [[], undefined ] )
  .shift()
  ;
}

Array.prototype.back = function (val) {
  if (val !== undefined) this[this.length-1] = val;
  return this[this.length-1];
}
Array.prototype.front = function (val) {
  if (val !== undefined) this[0] = val;
  return this[0];
}

Array.prototype.flat = function () { return this
  .reduce((xs, x) => xs.concat(x), [])
  ;
}

Array.prototype.ifEmpty = function (val) {
  return this.length ? this : val;
}

Array.prototype.ifEmptyElse = function (val, callback) {
  return this.length ? callback(this) : val;
}

String.prototype.ifEmpty = function (val) {
  return this.length ? this : val;
}

String.prototype.tagAs = function (tag, args) { // k=='style' ? v : v
  let serialize = a => Object.entries(a).map(([k, v])=>`${k}="${v}"`).join("");
  let res = '<' + tag;
  if (args) {
    res += ' ';
    res += serialize(args);
  }
  res += '>';
  res += this.toString();
  if (!(tag in ['br', 'hr', 'img'])) {
    res += '</' + tag + '>';
  }
  return res;
}

// chrome.storage.onChanged.addListener(function(c){
//   console.log(c);
// });

const storage = {
  set: function(args) {
    return new Promise((resolve) => chrome.storage.set(args, resolve));
  },
  get: function(args) {
    return new Promise((resolve) => chrome.storage.get(args, resolve));
  }
};

var tagAs = function (tag) {
  return function (x) {
    let tags = [];
    if (tag instanceof Array) [tag,...tags] = [...tag];
    if (tag === undefined) return x;
    let [tagName] = tag.split(/\s+/, 1);
    return tagAs(tags)('<' + tag + '>' + x + '</' + tagName + '>');
  }
}

var say = function (text) {
  let titles = ['Pane můj', 'Vládče náš', 'Ty, duše hříšná', 'Pane tohoto hradu'];
  return tagAs('p')(
    titles[Math.floor(Math.random() * titles.length)] + ', ' + text + '.'
  );
}

const mainLinks = document.querySelectorAll('#div_gui_main a');
const [lAct, lCastle, ...lDorp] = Array.from(mainLinks)
  .map(x => x.href.match(/\?x=(\d+)&y=(\d+)/))
  .filter(x => x!=null)
  .map(([,x,y])=> [x,y].map(x=>parseInt(x)) )
  ;

var locatedDoc = function (location) { // :t location == [x,y]
  if (location.every((x,i)=>x==lAct[i])) {
    return new Promise((resolve,) => { resolve(document); });
  }
  return new Promise((resolve, reject) => {
    // return resolve(document.createElement('div'));
    var req = new XMLHttpRequest();
    var page = ([x,y]) => `/main.aspx?x=${x}&y=${y}`;
    req.open('GET', page(location));
    req.onload  = (e) => {
      const doc = new DOMParser().parseFromString(req.responseText, 'text/html');
      resolve(doc);
    }
    req.onerror = (e) => reject(req.statusText);
    req.send();
  });
}

var serverTime = () => new Promise((resolve, reject) => {
  var req = new XMLHttpRequest();
  req.open('GET', '/time.aspx');
  req.onload  = (e) => resolve(req.responseText.split(',').map(x=>parseInt(x)));
  req.onerror = (e) => reject(req.statusText);
  req.send();
});

// console.log(serverTime.l);

var kHIDDEN = "-200px";
var kDISPLAYED = "0px";
var kHOVERED = "-190px";
var kHEALTH_WAITING = -1;

var injectExec = function(codeLambda, doc) {
  var script = document.createElement('script');
  script.textContent = '(' + codeLambda + ')();';
  (doc || document.head || document.documentElement).appendChild(script);
  // alert('s!');
  script.remove();
}

const dirs =
  [ []
  , [[[0,-1],[1,0],[0,1],[-1,0]]] // size = 1 (1x1)
  , [[[0,-1],[2,0],[0,2],[-1,0]], [[1,-1],[2,1],[1,2],[-1,1]]] // size = 2 (2x2)
];

var toTime = function (m, actm) {
  const text = minutes => ""
    + ('0' + Math.floor(minutes / 60)).slice(-2)
    + ':'
    + ('0' + Math.floor(minutes % 60)).slice(-2)
    ;
  const relativeDays = ['dnes', 'zítra', 'pozítří', 'popozítří',
                        'zadlouho', 'zadlouho', 'zadlouho', 'zadlouho'];
  const title =
    [ relativeDays[Math.floor((m+actm) / (60*24))]
    , 'v'
    , text((m+actm) % (60*24))
    ].join(' ')
    ;
  // return text(m);
  return text(m).tagAs('span', {title: title});
}

var toAmount = function (amount) {
  // alert(amount);
  if (amount == 0) return '0';
  if (!amount) return '-';
  var res = [];
  do {
    res.push(String("000" + amount%1000).slice(-3));
    amount = Math.floor(amount / 1000);
  } while (amount > 0);
  return res.reverse().join('.').replace(/^0*/, "");
}

var pan = {

  load: (file, callback) => {
    const req = new XMLHttpRequest();
    req.open('GET', file);
    req.onload = e => callback(req, e);
    req.send();
  },

  div: document.createElement('div'),

  sections: () => Object.values(pan.tabs),

  init: function () {
    var handle = document.getElementById('handle');
    var content = document.getElementById('content');

    // serverTime().then(e=> console.log(e));

    chrome.storage.sync.get(['panHidden', 'selectedSection'], o => {
      if (o.panHidden === undefined) {
        o = {panHidden: 0, selectedSection: Object.keys(pan.tabs).shift()}
        chrome.storage.sync.set(o);
      }
      pan.div.style.right = o.panHidden == 1 ? kHIDDEN : kDISPLAYED;
    });

    content.innerHTML = pan.sections()
      .map( ({name: n, title: t}) => [
        t.tagAs('h3', {id: n + '_header'}),
        "".tagAs('div', {id: n + '_content', class: 'content'})
      ])
      .flat()
      .join('')
      ;

    pan.sections().forEach( section => {
      section.content = document.getElementById(section.name + '_content');
      section.header = document.getElementById(section.name + '_header');
      section.isInit = false;
      // section.self = section;
    });
  },

  menu: {

    dom: function () { return document.getElementById('menu'); },

    load: function () {
      this.dom().innerHTML = pan.sections()
        .map( ({title: t, name: n}) => t.charAt(0)
          .toUpperCase()
          .tagAs('a', {
            href: '#' + n,
            class: n + (n == chrome.storage.sync.selectedSection ? ' active' : "")
          })
        )
        .join("")
        ;
    },

    handler: function (target, {dblclick: reload, isInitial: notRefresh} = {}) {
      // alert(target);
      // console.log(target);
      const who = ((target && target.className) || " ").split(/\s+/);
      pan.sections().forEach( section => {
        if (1 + who.indexOf(section.name)) {
          if (!section.isInit || reload) {
            section.isInit = true;
            section.init();
          }
          if (section.refresh && !notRefresh) {
            section.refresh();
          }
        }
        ['content', 'header'].forEach(part => {
          const el = document.getElementById(section.name + '_' + part);
          el && (el.style.display = 1+who.indexOf(section.name) ? 'block' : 'none');
        });
      });

      chrome.storage.sync.set({selectedSection: target.className.split(/\s+/)[0]});
      // console.log(target.className.split(/\s+/)[0]);
      // chrome.storage.sync.get('selectedSection', console.log);

      [].slice.call(this.dom().childNodes).forEach(child => {
        child.className = child.className.split(/\s+/).filter(x=>x!='active').join(' ');
      });
      target.className += ' active';
    }

  },

  tabs: {

    summary: {
      title: 'Přehledy',
      name: 'summary',

      init: function () {
        const self = pan.tabs.summary;
        Object.values(self.sections).forEach( x => self.content.appendChild(x()) );
      },

      sections: {
        playerName: function() {
          let res = document.createElement('div');
          let title = [...document.querySelectorAll('img.L2')]
            .filter(({src:x}) => x.match(/i\/b\/(ves|c)[0-9]\w+/))
            .map(({title: x}) => x)
            .groupBy(x => x)
            .map(([x,]) => x)
            ;

          let pC = x => x.tagAs('p', {style: 'text-align: center'})

          // console.log(title);
          res.innerHTML = (title || "")
            .map(x => x.match(/\(([^\(]*)\)$/))
            // .filter(x => x)
            .map(x => (x && x[1]) ? x[1].tagAs('p', {class:'player_name'})
                                  : pC('Tvoje území'))
            .join(pC(' & '))
            .ifEmpty(pC(say('tohle území nikomu nepatří')))
            ;
          return res;
        },
        lyingResources: function() {
          let res = document.createElement('div');
          res.class = 'lying_resources';

          let table = {'jídla': 0, 'dřeva': 0, 'kamene': 0, 'železa': 0};
          let images = {'jídla': 'food', 'dřeva': 'wood', 'kamene': 'stone', 'železa': 'iron'};
          let heaps = [...document.querySelectorAll('img.P')];

          const sumRow = heaps
            .map(({title: t}) => t
              .replace('Suroviny k sebrání: ', '')
              .split(', ')
              .map( (x,_,b) => x.split(' ').map( y => y.trim() ) )
            )
            .flat()
            .reduce( (table, [v, type]) => { table[type] += parseInt(v); return table }, table)
            ;

          res.innerHTML = Object.entries(images).map( ([key, img]) => ""
              + toAmount(sumRow[key]).tagAs('span', {class: 'amount '+img})
              + '&nbsp;'
              + "".tagAs('img', {src: 'i/s/'+img+'.gif', title: 'ležícího '+key, class: 'resource'})
            )
            .join('  ')
            .tagAs('p')
            ;

          return res;
        },
        units: function() {
          const unitsTable = (() => {
            const r = new XMLHttpRequest();
            r.open('GET', chrome.extension.getURL('/units.json'), {runAsync: false}.runAsync);
            r.send();
            return JSON.parse(r.responseText);
          })();

          const units = [...document.querySelectorAll('.unit')]
            .map(x => {
              const m = x.firstChild.title
                .match(/^(.*) (\(P\) )?\(útok ([0-9]+), obrana ([0-9]+)\)( - ([^\(\)]+)( \(([^\(\)]+)\))?)?$/)
                ;
              const p = m.splice(3, 2).map(x => parseInt(x));
              return {attack: p[0], defence: p[1], player: m[4] || '-', clan: m[6] || '-', val: x};
            })
            .sort((x,y) => {
              if (2.5*x.attack+x.defence == 2.5*y.attack+y.defence) {
                return y.attack - x.attack;
              }
              return 2.5*y.attack+y.defence - (2.5*x.attack+x.defence);
            })
            ;

          const content = units
            .map(o => {
              const x = o.val;
              const img = x.firstChild.cloneNode({deepCopy: true}.deepCopy);
              img.dataset.id = o.val.id.slice(1);
              img.src = (() => {
                let m = img.src.match(/\/i\/u\/(\w+)_\d_\df?s?\.gif$/);
                return m && unitsTable[m[1]]
                  ? `/i/u/${unitsTable[m[1]]}.png`
                  : img.src;
              })();
              const erb = x.querySelector('.F').src;
              const f = ""
                .tagAs('img', {
                  src: x.querySelector('.R').src
                })
                .tagAs('div', {
                  class: 'erb',
                  style: 'background-image:url(' + erb + ')'
                });
              const name = img.title.split(/\s*(\(|-)\s*/)[0];
              return [img.outerHTML.concat( "".tagAs('img', {
                        src: x.querySelector('.R').src
                      }).tagAs('div', {
                        class: 'unit_info',
                        style: `background-image: url(${x.querySelector('.F').src})`
                      }))
                     , o.attack.toString().concat('<br>').concat(o.defence).tagAs('div')
                     , name
                        .replace('Raněný zbrojnoš Béďa', 'Zbrojnoš Béďa')
                        .replace('Tvůj zbrojnoš Otakar', 'Zbrojnoš Otakar')
                        .tagAs('div')
                     ];
            })
            ;

          let res = document.createElement('div');
          res.class = 'units';
          res.innerHTML = '<br>'
            + content
              .map( x => x.map(tagAs('td')).join(''))
              .map(tagAs('tr'))
              .join('')
              .tagAs('table', {class: 'units'})
            ;

          [...res.querySelectorAll('.UI')].forEach(x => {
            x.onclick = e => injectExec('()=>unit.showUnitInfo('+e.target.dataset.id + ')');
          });

          return res;
        }

      }

    },

    fights: {
      title: 'Boje',
      name: 'fights',

      parseFights: function(els) {
        return Array.from(els)
          .reduce( ([m, ps], u) => {
            const {src:src, title:title, id:id, clientWidth:width} = u.querySelector('img.UI');
            const match = src.match(/(\w+(\d)_\d)fs?\.gif$/);
            if (!match) return [m, ps];
            const [,img, d] = match;
            const coor = [u.style.left, u.style.top].map( x => Math.round(parseInt(x) / 64));
            const size = Math.round(width / 64);
            m[coor.join()] = {img: img, dir: d-1, id: parseInt(id.slice(1)), name: title, size: size};
            // TODO : make (2x2) sizes work properly
            // console.log(size);
            for (let i=0; i < dirs[size].length; ++i) {
              let ds = dirs[size][i][d-1];
              let p = m[[coor[0]+ds[0], coor[1]+ds[1]].join()];
              if (p) ps.push([m[coor.join()], p]);
            }
            // console.log([m, ps]);
            return [m, ps];
          }, [{}, []])
          .pop()
          .map( x => x.sort( ({id: x}, {id: y}) => x - y))
          ;
      },

      renderFights: function(fs) {
        return fs
          .map( ab => ab
            // TODO sort by owner
            .map( (u, i) =>
              [ u.name
                  .replace(/\([^\)]*\)/g, "")
                  .split('-')
                  .map( x => x.trim())
                  .map( (x, i) => i==0 ? x : x.tagAs('i').tagAs('a', {href: '#'}) )
                  .reverse()
                  .join('<br>')
                  // .replace(/^(.*)-?(.*)$/, (_,j,a) =>  + '<br>' + j.trim())
                  // .replace(/\s+/g, '&nbsp;')
                  // .replace(/&nbsp;/, ' ')
                  .tagAs('div')
              , ""
                  .tagAs('img', {
                    title: u.name,
                    src: '/i/u/'
                          + [...u.img.split('_').slice(0,-2), (2*i+2), 3].join('_')
                          + 'f.gif'
                  })
              ]
            )
            .map( (xs, i) => i==0 ? xs : xs.reverse())
            .flat()
            .map(tagAs('th'))
            .join("")
            .tagAs('tr')
            .concat( ""
              .concat("".tagAs('td'))
              .concat( ""
                .tagAs('div', {
                  class: 'health_display'
                })
                .tagAs('td', {
                  colspan: 2,
                  style: 'border: 0'
                })
              )
              .concat("".tagAs('td'))
              .tagAs('tr', {
                id: pan.tabs.fights.fightId( ab.map(({id: id}) => id) ),
                class: 'display_row'
              })
            )
            .concat( ab
              .map(({id: id}) => ""
                .tagAs('div', {class: ['graph', 'fighting_'+id].join(' ')})
                .tagAs('td', {colspan: 2})
              )
              .join("")
              .tagAs('tr')
            )
          )
          .map( x => x
            .tagAs('tbody')
            .tagAs('table', {
              class: 'fights'
            })
          )
          .join("")
          .ifEmpty(say('nevidím žádné souboje').tagAs('p').tagAs('center'))
          .concat('<br>' + say('může se stát, že souboj s (2x2) jednotkou nezaznamenám'))
          ;
      },

      initAllFights: function(allFs, time) {
        chrome.storage.sync.get(null, oo => {
          oo.fights = oo.fights || [];
          allFs.forEach( ab => {
            const ids = ab.map(({id: x}) => x);
            const fightID = pan.tabs.fights.fightId(ids);
            const saved = oo.fights.find(({id: x}) => x == fightID);
            if (saved === undefined) {
              oo.fights.push({startTime: time, id: fightID});
              chrome.storage.sync.set(oo);
            } else {
              ids.forEach( id => {
                // alert(o.health[id]);
                if (!oo['health_'+id]) return;
                oo['health_'+id].filter(({time: t}) => saved.startTime <= t).forEach( h => {
                  // console.log(id, v);
                  pan.tabs.fights.updateGraphsWith(id, h.value, h.time);
                });
              });
            }
          }); // forEach (ab)
        }); // chrome.storage.sync.get(null, oo)
      },

      timeoutID: null,

      updateAllFights: function(allFs, time, timeOut = 60) {
        allFs
          .forEach( ab => {
            let isDead = false;
            ab.forEach( x =>
              pan.tabs.fights.healthTracker(x.id, time, y => {
                pan.tabs.fights.updateGraphsWith(x.id, y)
                if (y.hMax == 0) isDead = true;
              })
            );
            if (isDead) return;
            pan.tabs.fights.timeoutID = setTimeout(() =>
              pan.tabs.fights.updateAllFights(allFs, time+1),
              timeOut*1000);
          })
          ;
      },

      init: function () {
        if (pan.tabs.fights.timeoutID) {
          clearTimeout(pan.tabs.fights.timeoutID);
          pan.tabs.fights.timeoutID = null;
        }
        const fs = pan.tabs.fights.parseFights(document.querySelectorAll('.unit'));

        chrome.storage.sync.get('persistentFights', o => {
          o.persistentFights = o.persistentFights || [];
          chrome.storage.sync.set(o);
          // console.log(o.persistentFights);
          const filterdFs = fs.filter( ([{id:aID}, {id: bID}]) =>
            undefined === o.persistentFights.find(pan.tabs.fights.fightFinder(aID, bID))
          );

          const allFs = [...o.persistentFights,...filterdFs];
          pan.tabs.fights.content.innerHTML = pan.tabs.fights.renderFights(allFs);

          serverTime().then( prom => {
            const serverTime = (prom[2]*24 + prom[3])*60 + prom[4];
            const nextUpd = 60 - prom[5] + /*bias: */ 4;
            pan.tabs.fights.initAllFights(allFs, serverTime);
            pan.tabs.fights.updateAllFights(allFs, serverTime, nextUpd);
          }); // serverTime (time)

          // Register events for persistent fights
          [...pan.tabs.fights.content.querySelectorAll('table')].forEach( el => {
            const {id: strFightID} = el.querySelector('.display_row');
            const fightID = parseInt(strFightID);
            const unitIDs = strFightID.split('_').slice(1).map(x=>parseInt(x));
            const fightFinder = pan.tabs.fights.fightFinder(unitIDs[0], unitIDs[1]);
            if ({isPersistent: o.persistentFights.find(fightFinder)}.isPersistent) {
              el.className += ' persistent';
            }
            [...el.querySelectorAll('th')].splice(1,2).forEach( ell => ell.ondblclick = e => {
              chrome.storage.sync.get('persistentFights', oo => {
                if ({isPersistent: oo.persistentFights.find(fightFinder)}.isPersistent) {
                  el.className = el.className.split(/\s+/).filter(x => x!='persistent').join(' ');
                  oo.persistentFights = oo.persistentFights.filter(x=>!fightFinder(x));
                } else {
                  el.className += ' persistent';
                  const value = allFs.find(fightFinder);
                  if (!value) {
                    alert(value);
                    console.log(fs);
                    console.log(strFightID);
                  }
                  oo.persistentFights.push(value);
                }
                chrome.storage.sync.set(oo);
              })
            }); // ell.ondblclick, forEach (ell)
          }); // forEach (el)

          // Register hover events
          [...document.querySelectorAll('.graph')].forEach( el => {
            let parent = (i, ell) => i == 0 ? ell : parent(i-1, ell.parentNode);
            let rightClasses = ({className: x}) => x
              .split(' ')
              .filter(v => 1+['h', 'h_max'].indexOf(v))
              ;
            el.onmouseover = ({target: t}) =>
            t && rightClasses(t).length
            ? parent(5, t).querySelector('.health_display').innerHTML =
            t.dataset.value + "".tagAs('img',  {src:'i/s/hea.gif', width: 14})
            : false
            ;
            el.onmouseout = ({target: t}) =>
            t && rightClasses(t).length
            ? parent(5, t).querySelector('.health_display').innerText = ""
            : false
            ;
          }); // forEach (el)
        }); // chrome.storage.sync.get('persistentFights')
      },

      fightId: function ([unitID1, unitID2]) {
          [unitID1, unitID2] = [unitID1, unitID2].sort((x,y) => y - x);
          return `fight_${unitID1}_${unitID2}`;
      },

      fightFinder: (a,b) => ([{id: aID}, {id: bID}]) => a==aID && b==bID || b==aID && a==bID,

      updateGraphsWith: function (id, [h, hMax], time) {
        const kSCALE = 5;
        // let  = args.map( x => x < 0 ? 0 : x)
        let fightings = [...document.querySelectorAll('.fighting_' + id)];
        // console.log(fightings);
        let title = `${h} z ${hMax}`;
        let dayT = Math.floor(time%(24*60));
        let label = (time ? `${Math.floor(dayT/60)}:${dayT%60} -` : "") + title;
        fightings.forEach( y => y.innerHTML = h
          .toString()
          .tagAs('div', {
            class: `h ${h > 0 ? "" : ' death'}`,
            style: `height:${h/kSCALE}px`,
            title: label,
            'data-value': title
          })
          .tagAs('div', {
            class: `h_max ${hMax > 0 ? "" : ' death'}`,
            style: `height:${h > 0 ? hMax/kSCALE : y.clientHeight-1}px`,
            title: label,
            'data-value': title
          })
          .concat(y.innerHTML)
        );
      },

      parseAttribute: function(attr, html) {
        const m = html
          .split('</tr>')
          .map( x =>
            x.match( new RegExp( '<tr><td>' + attr + ':</td><td[^>]*>(.*)</td>'
              .replace(/[\\\<\>]/,'\\$&'),
            ))
          )
          .filter(x => x)
          .shift()
          ;
        // console.log(m);
        if (!m || !m[1]) return [0, 0];
        const hlth = m[1].split(' z ');
        return [ parseInt( hlth[0] )
               ,  eval( hlth[1].replace(/\<[^\>]+\>/g, "") )
               ];
      },

      healthTracker: function(unitID, time, callback) {
        chrome.storage.sync.get([`health_${unitID}`], ({[`health_${unitID}`]: h}) => {
          h = h || [];
          if (h.length > 0 && h.back().time >= time ) {
            return;
          }
          h.push({time: time});
          chrome.storage.sync.set({[`health_${unitID}`]: h});
          const r = new XMLHttpRequest();
          r.open('POST', '/unit_info.aspx?id=u' + unitID);
          r.onload = e => {
            const html = eval(r.responseText).filter(({attr:x})=>x=='html').map(({val:x})=>x).shift();
            const value = pan.tabs.fights.parseAttribute('Zdraví', html);
            h.back({time: time, value: value});
            chrome.storage.sync.set({[`health_${unitID}`]: h}, () => callback(value));
          }
          r.send();
        });
      }


    },

    resources: {

      title: 'Suroviny',
      name: 'resources',
      init: function() {
        const capacity = parseInt(document.getElementById('max_capacity').innerHTML);
        const fortune = ['gold', 'food', 'wood', 'stone', 'iron'].map( x => { return {
          type: x,
          amount: parseInt( document.getElementById('mb_' + x).innerText
                              .split('').filter(x=>x!='.').join('')
                  ),
          inc: parseInt( document.getElementById('mb_' + x + '_i').innerText )
        };});

        pan.tabs.resources.content.innerHTML = fortune
            .map(({type:t}) => "".tagAs('tbody', {id: 'table_' + t}))
            .join("")
            .tagAs('table', {class: 'amounts'});

        fortune.forEach( x => {
          const result = pan.tabs.resources.content.querySelector('#table_' + x.type);
          // alert(x.type + '# ' + result);
          const img = "".tagAs('img', {src: 'i/s/' + x.type + '.gif', title: x.type});
          const hr = (a,b) => (b.tagAs('th', {class: 'amount '+x.type}) + [a,'nyní'].map(tagAs('th')).join("")).tagAs('tr');
          const tr = (b,c) => (b.tagAs('td', {class: 'amount '+x.type}) + ["",    c].map(tagAs('td')).join("")).tagAs('tr');
          result.innerHTML = hr(img, toAmount(x.amount));

          serverTime().then( time => {
            const actm = time[3]*60 + time[4];
            if (x.type == 'food') {
              const foodVals = { 'Obilné pole': 5000, 'Zeleninová zahrádka': 450 };
              const foodSteps = 7;
              const regExp = new RegExp('(' + Object.keys(foodVals).join('|') + ') \\((\\d)\\)[^\\(]*$');

              const docPs = [lCastle,...lDorp].map(locatedDoc);
              const mod = (x,y) => Math.floor(x/y);
              const remains = h => h==0 ? 0 : (mod(time[3]-1+h,3) * 3 + 1 - time[3]) * 60 - time[4];
              const cca = '~'.tagAs('small');
              Promise.all(docPs).then( docs => {
                result.innerHTML += docs
                  .map(d => Array.from(d.querySelectorAll('div.L2.building'))
                    .map( b => b.querySelector('img') )
                    .map( ({title: x}) => x.match(regExp))
                    .filter( x => x != null )
                    .map( ([, t, l]) => [t, parseInt(l)])
                  )
                  .flat()
                  .sort( ([,a], [,b]) => b - a)
                  .groupBy( ([,a]) => a)
                  .map( xs => [ remains((foodSteps - xs[0][1]) * 3)
                              , xs.reduce( (v, [t,]) => foodVals[t]+v, 0)]
                  )
                  .reduce( ([xs,lv], [h,v]) => [[...xs, tr(cca+toAmount(lv+v), toTime(h, actm))], lv+v]
                         , [[], x.amount]
                  )
                  .shift()
                  .join("")
                  ;
                });
            } else { // x.type != 'food'
              const amounts = [1000, 2000, 3000, 5000, 8000, 10000, 12000,
                               15000, 20000, 25000, 30000, 35000, 40000, 45000,
                               50000, 55000, 60000, 70000, 80000, 90000, 1000000];
              const time = y => (y-x.amount)/x.inc;
              result.innerHTML += amounts
                .filter( v => x.amount <= v && v < capacity)
                .filter( function(v, i, a) {
                  if (i == 0 || time(v) - time(a[this.last]) >= 60) {
                    this.last = i;
                    return true;
                  }
                  return false;
                })
                .concat([capacity])
                .slice(0, 5)
                .map( v => parseInt(v))
                .map( v => tr(toAmount(v), toTime(time(v), actm)))
                .join("")
                ;
            }
          });
        });
      }
    },

    post:  {

      title: 'Pošta',
      name: 'post',
      refresh: function() {
        injectExec(() => {
          $('#tl_posta_pocet').text("");
          $('#img_posta_obalka').show();
        });
      },
      init: function() {

        pan.tabs.post.content.innerHTML = ""
          .tagAs('iframe', {
            src: '/forum_mails.aspx',
            id: 'posta_frame',
            style: 'display: none'
          })
          .tagAs('div', {
            class: 'iframe_wrap',
            scrolling: 'no'
          })
          .concat(`
              <div class="form_post">
              <form name="forum" id="forum" onsubmit="return false" method="post">
              <div class="input_wrap">
                <input type="text" name="edit_player_name" id="edit_player_name"
                       class="f-tb" placeholder="adresát">
              </div>
              <textarea class="editbox"rows="5" id="text_area" name="text_area"></textarea>
              <input type="hidden" name="presneHrac" id="presneHrac" value="">
              <input type="image" name="odeslat" id="odeslat" src="i/forums/button_send.gif"
                     onmouseover="this.src='i/forums/button_send_a.gif'"
                     onmouseout="this.src='i/forums/button_send.gif'">
              </form>
              </div>`
          )
          ;

        const form = pan.tabs.post.content.querySelector('#forum');
        const iframe = pan.tabs.post.content.querySelector('#posta_frame');
        let frameDoc = null;
        let page = 1;
        const fnc = e => {
          // Note: remove notification from 'Forum' main link
          frameDoc = iframe.contentDocument;

          const style = frameDoc.createElement('style');
          style.innerText = '@import url("' + chrome.extension.getURL('posta.css') + '");';
          frameDoc.body.appendChild(style);
          const as = [...frameDoc.querySelectorAll('.msg_text a')]
          as.forEach(x => x.target='top');
          as.map(x => [x, x.href.match(/^javascript:(.*)$/)])
            .filter(([,m]) => m && m[1])
            .forEach(([x,m]) => {
              x.onclick = e => injectExec('()=>{'+m[1]+'}') && false;
              x = {href: '#javascript', target: ""};
              x.onmouseup = e => false;
              x.onmousedown = e => false;
            });

          [...frameDoc.querySelectorAll('.player_name_div')].forEach( el => {
            el.onclick = e => {
              form.querySelector('#edit_player_name').value =
                el.querySelector('.player_name').innerText;
            };
          });

          const {href: href} = frameDoc.querySelector('.navigation a:first-child');
          frameDoc.querySelector('.msg_box').onscroll = ({target: el}) => {
            if (el.scrollHeight - el.scrollTop === el.clientHeight) {
              const r = new XMLHttpRequest();
              page++;
              r.open('GET', href.replace('page=1', `page=${page.toString()}`));
              r.onload = ee => {
                const dom = new DOMParser().parseFromString(r.responseText, 'text/html');
                let msgs = `strana ${page}:`
                  .tagAs('div', {class: 'page_breaker'});
                msgs += dom.querySelector('.msg_box').innerHTML;
                frameDoc.querySelector('.msg_box').insertAdjacentHTML('beforeend', msgs);
                fnc(e);
              };
              r.send();
            }
          };

          frameDoc.querySelector('.player_name_div').click();
          iframe.style.display = 'block';
        }

        iframe.onload = fnc;


        form.querySelector('#text_area').oninput = ({target: el}) => {
          el.style.height = "";
          el.style.height = Math.min(el.scrollHeight, iframe.clientHeight) + 'px';
        };

        const inputs = ['presneHrac', 'edit_player_name', 'odeslat', 'text_area'];
        form.onsubmit = e => {
          form.querySelector('#text_area').value =
            form.querySelector('#text_area').value
              .replace(/O:(-)?\)/g, '*8-*')
              .replace(/:(-)?\)/g, '*:)*')
              .replace(/\$([a-z])/g, '*x$1*')
              .replace(/\$\$/g, '*-*')
              .replace(/\$/g,'*xp*')
              .replace(/\(y\)/g, '*u*')
              ;
          inputs.forEach( id => {
            frameDoc.querySelector('#'+id).value = form.querySelector('#'+id).value;
            form.querySelector('#'+id).value = "";
          });
          frameDoc.querySelector('#cb_admins').selectedIndex = 0;
          frameDoc.querySelector('#forum').submit();
        };

        window.onbeforeunload = e => chrome.storage.local.set({
            post: ['edit_player_name', 'text_area'].reduce( (o, id) => {
              o[id] = form.querySelector('#'+id).value;
              return o;
            }, {})
          });

        chrome.storage.local.get('post', ({post: o}) => {
            Object.entries(o).forEach( ([id, v]) => {
              form.querySelector('#'+id).value = v;
            });
        });

      }

    },

    // geography: {
    //   title: 'Zeměpisec',
    //   name: 'geography',
    //   init: function () {
    //     var food = d=>[...d.querySelectorAll('img.P')].map(({title:x})=>x.match(/Suroviny k sebrání: (\d+) jídla/)).filter(x=>x).map(([,x])=>parseInt(x)).reduce((a,b)=>a+b,0)
    //     var drak = d=>[...d.querySelectorAll('img')].map(({src: x})=>x.match(/\/dr([a-z])_/)).filter(f=>f&&f[1]).map(([,x])=>x).join(' ')
    //     // var hrac = d=>[...d.querySelectorAll('img.UI')].map(({src: x}) => x.match(/.*- Larkin II \(.*/)).filter(f=>f&&f[0]).map(([x])=>x)
    //     var hrac = d=>[...d.querySelectorAll('img.UI')].map(({title: x}) => x.match(/(.*)- Larkin II \(.*/)).filter(f=>f&&f[1]).map(([,x])=>x)
    //     var prase = d=>[...d.querySelectorAll('img.UI')].map(x=>[x.src.match(/\/dv_/),x.id]).filter(([f])=>f&&f[0]).map(([,x]) => x)
    //     /*
        // document.body.innerText.split('\n').map(x=>x.split('>')).filter(f=>f && f[2]=='orc').forEach(([x,y,t,m])=>{
        //   const r = new XMLHttpRequest();
        //   const u = `/main.aspx?x=${x}&y=${y}`;
        //   r.open('GET', u, false);
        //   r.onload = e => {
        //       var z = new DOMParser().parseFromString(r.responseText, 'text/html');
        //       console.log(drak(z)+prase(z)+'\t'+u+'\n')
        //
        //     };
        //   console.log('> ' + u + '\t\t' + [x,y,t,m]);
        //   r.send();
        // })
    //     */
    //     pan.tabs.geography.content.innerHTML = ""
    //     + []
    //   }
    // },

    version: {

      title: 'Verze rozšíření',
      name: 'version',
      init: function () {
        with (pan.tabs.version) {
          content.innerHTML = `
              <p align="center">
              Tento Správce je rozšíření pro Google Chrome
              a slouží pouze jako neoficiální uživatelká podpora ke hře.
              Bylo vytvořeno na začátku roku 2018
              <a href="http://marekcerny.com" target="_blank">Markem</a>.
              </p>
              <h4>GitHub</h4>
              <p>Projekt sídlí a je ke stažení na
                <a href="https://github.com/marek094/pan">GitHub.com</a>
              </p>
              <h4>Nápověda</h4>
              <p>Tip: Dvojklikem na odkaz v&nbsp;menu se celá sekce načte znovu.
              </p>
              <p>Tip: Dvojklikem na bojující dvojici v&nbsp;sekci 'Boje' se souboj trvale připne.
              </p>
              <p>Tip: Při psaní zprávy zkuste použít '$', '$$', '$j', ':)', 'O:-)'
              </p>
              <h4>Užitečné odkazy</h4>
              <ul>
                <li><a href="/help/rady_veterana.htm" target="_blank">
                    Veteránova nápoveda</a></li>
              </ul>
              <h3>Nastavení</h3>
              <p id="clear_data_notif"></p>
              <p>
                <label for="clear_data">Smaž uložená data: </label><button id="clear_data">reset</button>
              </p>
          `;

          content.querySelector('#clear_data').onclick = e => chrome.storage.sync.clear(() =>
            content.querySelector('#clear_data_notif').innerText = 'Uložená data byla vymazána'
          );
        }
      }
    }

  }
};


var main = function(e) {
  with (pan) {

    init();
    menu.load();
    chrome.storage.sync.get('selectedSection', ({selectedSection: x}) =>
      menu.handler(
        document.querySelector(`#menu .${x}`) || document.querySelector('#menu a:first-child'),
        {isInitial: true}
      )
    );
    // sections().forEach( ({init: f}) => f());

    const handle = document.getElementById('handle');
    handle.onclick = function(e) {
      chrome.storage.sync.get('panHidden', o => {
        if (o.panHidden == 1) {
          div.style.right = kDISPLAYED;
          chrome.storage.sync.set({panHidden: 0});
        } else {
          if (e.target.id != 'handle' && e.target.className != 'inner') {
            return menu.handler(e.target);
          }
          div.style.right = kHIDDEN;
          chrome.storage.sync.set({panHidden: 1});
        }
      });
    }

    handle.onmouseover = function(e) {
      if (div.style.right == kHIDDEN) {
        div.style.right = kHOVERED;
      }
    };

    handle.onmouseout = function(e) {
      if (div.style.right == kHOVERED) {
        div.style.right = kHIDDEN;
      }
    };

    [...document.querySelectorAll('#handle a')].forEach( el =>
      el.ondblclick = ({target: ell}) => menu.handler(ell, {dblclick: true})
    );

  }
};

document.body.onload = function () {
  pan.div.id = 'pan_extension';
  const url = chrome.extension.getURL('pan.html');
  pan.load(url, r => {
    pan.div.innerHTML = r.responseText;
    main();
  });
  document.body.appendChild(pan.div);
};
