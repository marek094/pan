
Array.prototype.groupBy = function (selector) { return this
  .reduceRight( ([[xs,...xss], lv], w) => {
      const v = selector(w);
      const x = xs ? [xs,...xss] : [];
      return [lv==v ? [[w,...xs],...xss] : [[w],...x], v];
    }, [[], undefined ] )
  .shift()
  ;
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

String.prototype.tagAs = function (tag, args) {
  var res = '<' + tag;
  if (args) {
    res += ' ';
    res += Object.entries(args).map( ([k, v]) => k + '="' + v + '"').join(' ');
  }
  res += '>';
  res += this.toString();
  if (!(tag in ['br', 'hr', 'img'])) {
    res += '</' + tag + '>';
  }
  return res;
}

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

var injectExec = function(codeLambda) {
  var script = document.createElement('script');
  script.textContent = '(' + codeLambda + ')();';
  (document.head||document.documentElement).appendChild(script);
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

    handler: function (target) {
      // alert(target);
      // console.log(target);
      const who = (target.className || " " ).split(/\s+/);
      pan.sections().forEach( ({name: section}) => {
        ['content', 'header'].forEach(part => {
          const el = document.getElementById(section + '_' + part);
          if (!el) return;
          el.style.display = (who.indexOf(section) > -1 ? 'block' : 'none');
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
            .join(pC(' a '))
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
          let add2 = (a, b) => a.map( (v,i) => v + b[i] );

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
            ;

          return res;
        },

        units: function() {
          var cont = [...document.querySelectorAll('.unit')]
            .map(x => {
              var p = x.firstChild.title
                .match(/\(útok ([0-9]+), obrana ([0-9]+)\)/)
                .map(x => parseInt(x));
              return {attack: p[1], defence: p[2], val: x};}
             )
            .sort((x,y) => {
              if (x.attack+x.defence == y.attack+y.defence) {
                return y.attack - x.attack;
              }
              return y.attack+y.defence - (x.attack+x.defence);
            })
            .map(o => {
              const x = o.val;
              const img = x.firstChild;
              img.dataset.id = o.val.id.slice(1);
              const erb = x.getElementsByClassName('F')[0].src;
              const f = ""
                .tagAs('img', {
                  src: x.getElementsByClassName('R')[0].src
                })
                .tagAs('div', {
                  class: 'erb',
                  style: 'background-image:url(' + erb + ')'
                });
              const name = img.title.split(/\s*(\(|-)\s*/)[0];
              return [f
                     ,img.outerHTML
                     ,o.attack.toString() + '<br>' + o.defence
                     ,name
                     ];
            })
            ;

          let res = document.createElement('div');
          res.class = 'units';
          res.innerHTML = '<br>'
            + cont
              .map( x => x.map(tagAs('td')).join(''))
              .map(tagAs('tr'))
              .join('')
              .tagAs('table', {class: 'units'})
            + '<br>'
              .tagAs('p', {style: 'line-height:300px;'})
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
      init: function () {
        // alert(Object.keys(pan.tabs.fights));
        const fs = Array.from(document.querySelectorAll('.unit'))
          .reduce( ([m, ps], u) => {
            const {src:src, title:title, dataset:{id:id}, clientWidth:width} = u.querySelector('img.UI');
            const match = src.match(/(\w+(\d)_\d)f\.gif$/);
            if (!match) return [m, ps];
            const [,img, d] = match;
            const coor = [u.style.left, u.style.top].map( x => Math.round(parseInt(x) / 64));
            const size = Math.round(width / 64);
            m[coor.join()] = {img: img, dir: d-1, id: parseInt(id), name: title, size: size};
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
          .map( x => [ 'fight_' + x[0].id + '_' + x[1].id
            , x.sort( ({id: x}, {id: y}) => x-y)
            ]
          )
          ;

        pan.tabs.fights.content.innerHTML = fs
          .map( ([id, ab]) => [ id,
            ab
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
              .map(tagAs('td'))
              .join("")
            ]
          )
          .map(([id, x]) => x
            .tagAs('tr')
            .tagAs('tbody', {id: id})
            .tagAs('table', {class: 'fights'})
          )
          .join("")
          .ifEmpty(say('nevidím žádné souboje').tagAs('p').tagAs('center'))
          .concat('<br>' + say('může se stát, že souboj s (2x2) jednotkou nezaznamenám'))
          ;

          const update = () => fs.forEach( ([id, ab]) => {
            var row = document.createElement('tr');
            row.class = 'fight_stats';
            row.innerHTML = ab
              .map( x => ""
                .tagAs('div', {style: ''})
                .tagAs('td', {id: id + '_' + x.id, colspan: 2})
              )
              .join('')
              ;
            document.querySelector('#'+id).appendChild(row);
            ab.forEach( x => pan.tabs.fights.healthTracker(x.id, ([h, h_max]) =>
                row.querySelector('#' + id + '_' + x.id).innerText = h + '/' + h_max
              )
            );
          });

          update();
          setInterval(update, 60*1000);
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
        if (!m || !m[1]) return [-1,-1];
        const hlth = m[1].split(' z ');
        return [ parseInt( hlth[0] )
               ,  eval( hlth[1].replace(/\<[^\>]+\>/g, "") )
               ];
      },

      healthTracker: function(unitID, callback) {
        const r = new XMLHttpRequest();
        r.open('POST', '/unit_info.aspx?id=u' + unitID);
        r.onload = e => {
          const html = eval(r.responseText).filter(({attr:x})=>x=='html').map(({val:x})=>x).shift();
          callback(pan.tabs.fights.parseAttribute('Zdraví', html));
        }
        r.send();
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
              const amounts = [1000, 2000, 3000, 5000, 8000, 10000, 15000, 20000, 30000, 40000, 50000];
              result.innerHTML += amounts
                .filter( v => x.amount <= v && v < capacity)
                .concat([capacity])
                .slice(0, 5)
                .map( v => parseInt(v))
                .map( v => tr(toAmount(v), toTime((v-x.amount)/x.inc, actm)))
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
          ;

        const iframe = pan.tabs.post.content.querySelector('#posta_frame');
        // alert(pan.tabs.post.content.innerHTML);
        iframe.onload = function (e) {
          let frameDoc = iframe.contentDocument;
          let submit = frameDoc.getElementById('odeslat');
          let input = frameDoc.getElementById('edit_player_name');
          let textarea = frameDoc.getElementById('text_area');

          input.placeholder = 'adresát';
          [input, textarea, submit].forEach((e,i)=>{e.tabindex = i+10});

          const style = frameDoc.createElement('style');
          style.innerText = '@import url("' + chrome.extension.getURL('posta.css') + '");';
          frameDoc.body.appendChild(style);
          const as = [...frameDoc.querySelectorAll('.msg_box a')]
          as.forEach(x => x.target='top');
          as.map(x => [x, x.href.match(/^javascript:(.*)$/)])
            .filter(([,m]) => m && m[1])
            .forEach(([x,m]) => {
              x.onclick = e => injectExec('()=>{'+m[1]+'}') && false;
              x = {href: '#javascript', target: ""};
              x.onmouseup = e => false;
              x.onmousedown = e => false;
              // console.log(x);
            });

          iframe.style.display = 'block';
        }
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
    //     document.body.innerText.split('\n').map(x=>x.split('>')).filter(f=>f && f[2]=='orc').forEach(([x,y,t,m])=>{
    //       const r = new XMLHttpRequest();
    //       const u = `/main.aspx?x=${x}&y=${y}`;
    //       r.open('GET', u, false);
    //       r.onload = e => {
    //           var z = new DOMParser().parseFromString(r.responseText, 'text/html');
    //           console.log(drak(z)+prase(z)+'\t'+u+'\n')
    //
    //         };
    //       console.log('> ' + u + '\t\t' + [x,y,t,m]);
    //       r.send();
    //     })
    //     */
    //     pan.tabs.geography.content.innerHTML = ""
    //     + []
    //   }
    // },

    version: {

      title: 'Verze rozšíření',
      name: 'version',
      init: function () {
        pan.tabs.version.content.innerHTML = `
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
            <h4>Užitečné odkazy</h4>
            <ul>
              <li><a href="/help/rady_veterana.htm" target="_blank">
                  Veteránova nápoveda</a></li>
            </ul>
        `;
      }

    }

  }
};


var main = function(e) {
  with (pan) {

    init();
    menu.load();
    chrome.storage.sync.get('selectedSection', ({selectedSection: x}) =>
      menu.handler(document.querySelector('#menu .' + x))
    );
    sections().forEach( ({init: f}) => f());

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
