/*
 * lib/semconvert.js can be used online or CLI to filter and transform RDF*
 */

import { Parser, Writer, Store } from 'n3';

// https://stackoverflow.com/questions/6122571/#8831937
function simpleHash(str, prefix='h') {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return prefix + Math.abs(hash);
}

class UniqueArray extends Array {
  pushIndexOf(key) {
    if (this.indexOf(key)==-1) {
      this.push(key);
    }
    return this.indexOf(key);
  }
}

class OutWriter {
  constructor(options={}) {
    this.options = options;
    this.store = new Store();
  }
  addQuad(quad) {
    this.store.addQuad(quad);
  }
  addPrefixes(prefixes) {
    this.store.add(prefixes);
  }
  stripUrl(urlStr) {
    const url = new URL(urlStr);
    return url.hash.replace('#','')      // the hash WITHOUT the octothorp
      || url.pathname.split('/').at(-1)  // the last part of the path
      || url.hostname;                   // the hostname
  }
}
class GraphViz extends OutWriter {
  constructor(options={}) {
    super(options);
  }
  addQuad(quad) {
    this.store.addQuad(quad);
  }
  addPrefixes(prefixes) {
    this.store.add(prefixes);
  }
  getNodes() {
    var nodes = [];
    for (const subj of this.store.getSubjects()) {
      const k = simpleHash(subj.value);
      nodes[k] = subj.value;
    }
    for (const obj of this.store.getObjects()) {
      const k = simpleHash(obj.value);
      nodes[k] = obj.value;
    }
    return nodes;
  }
  getEdges() {
    const {squelch} = this.options;
    // console.log(this.options);
    // if (!squelch) process.exit(9);
    var edges = ['  // edges'];
    for (const quad of this.store.getQuads()) {
      const subjHash = simpleHash(quad.subject.value);
      const objHash = simpleHash(quad.object.value);
      if (quad.predicate.value) {
        const predNick = this.stripUrl(quad.predicate.value);
        const l = squelch ? '' : `label="${predNick}"`;
        edges.push(`  ${subjHash} -> ${objHash}[${l}];`);
      }
    }
    return edges;
  }
  genDot() {
    const {squelch} = this.options;
    const retlist =[
      `digraph doh {`,
      '  rankdir="LR";',
      '  // nodes'
    ];
    for (const [k,v] of Object.entries(this.getNodes())) {
      const l = `label="${squelch ? '' : v}"`;
      retlist.push(`  ${k}[${l}];`);
    }
    for (const e of this.getEdges().values()) {
      retlist.push(e);
    }
    retlist.push(`}`);
    return retlist.join(`\n`)
  }
  end(cb) {
    let error;
    let result = this.genDot();
    cb(error, result);
  }
}

class TableWriter extends OutWriter {
  constructor(options={}) {
    super(options);
    this.line_prefix = '';
    this.line_postfix = '';
    this.col_delim = '';
    this.col_prefix = '';
    this.col_postfix = '';
  }
  disciplineSubject(subj) {
    return this.options.stripUrls ? this.stripUrl(subj.value) : subj.value;
  }
  disciplinePredicate(pred) {
    return this.options.stripUrls ? this.stripUrl(pred.value) : pred.value;
  }
  getChart() {
    let labels = new UniqueArray();
    let chart = {datasets: []}
    for (const subj of this.store.getSubjects()) {
      if (subj.value == '') continue; // skips DefaultGraph
      let row = {label:this.disciplineSubject(subj), data:[]};
      for (const pred of this.store.getPredicates(subj, null, null)) {
        if (pred.value == '') continue; // skips DefaultGraph
        var cookedPred = this.disciplinePredicate(pred);
        var colIdx = labels.pushIndexOf(cookedPred);
        for (const quad of this.store.getQuads(subj, pred, null)) {
          row.data[colIdx] = quad.object.value;
        }
      }
      chart.datasets.push(row);
    }
    chart.labels = Array.from(labels.values());
    return chart;
  }
  makeLine(vals) {
    // this really should iterate through the values so they can be escaped!!!
    return this.line_prefix
      + (vals.length ? this.col_prefix : '')  // only if there are vals
      + vals.join(this.col_prefix + this.col_delim + this.col_postfix)
      + (vals.length ? this.col_postfix : '') // only if there are vals
      + this.line_postfix
      + "\n";
  }
  decorateTable() {
    let chart = this.getChart();
    let table = this.makeLine([''].concat(chart.labels));
    for (const row of chart.datasets) {
      table += this.makeLine([row.label].concat(row.data));
    }
    return table;
  }
  end(cb) {
    let error;
    let result = this.decorateTable();
    cb(error, result);
  }
  FUTURE__get_or_make_id_for_quad(quad) {
    return [quad.subject, quad.predicate, quad.object].join(' ');
  }
}
class ChartData extends TableWriter {
  decorateTable() {
    return JSON.stringify(this.getChart(), null, 4);
  }
}
class OrgModeTable extends TableWriter {
  constructor(options={}) {
    super(options);
    this.line_prefix = '|';
    this.line_postfix = '|';
    this.col_delim = '|';
  }
}
class TabSeparatedTable extends TableWriter {
  constructor(options={}) {
    super(options);
    this.col_delim = "\t";
  }
}
class CommaSeparatedTable extends TableWriter {
  constructor(options={}) {
    super(options);
    this.col_delim = ',';
    this.col_prefix = '"';
    this.col_postfix = '"';
  }
}

function covers(passOrDenyRegexList, valueList) {
  for (const re of passOrDenyRegexList) {
    const regex = new RegExp(re);
    for (const value of valueList) {
      if (regex.test(value)) return true;
    }
  }
  return false;
}

function isQuadPermitted(quad, options) {
  let {
    denySubjLike, passSubjLike,
    passPredLike, denyPredLike,
    passEntityLike, denyEntityLike,
    passObjLike, denyObjLike
  } = options;
  // Entity is the equivalent of Subj OR Obj, so propagate it...
  const entityValues = [quad.subject.value, quad.object.value];
  if ((denySubjLike && covers(denySubjLike, [quad.subject.value]))
      || (denyPredLike && covers(denyPredLike, [quad.predicate.value]))
      || (denyObjLike && covers(denyObjLike, [quad.object.value]))
      || (denyEntityLike && covers(denyEntityLike, entityValues))
      || (passSubjLike && ! covers(passSubjLike, [quad.subject.value]))
      || (passPredLike && ! covers(passPredLike, [quad.predicate.value]))
      || (passObjLike && ! covers(passObjLike, [quad.object.value]))
      || (passEntityLike && !covers(passEntityLike, entityValues))) {
    return false;
  }
  return true; // quads are permitted by default
}

function semconvert(inputData, callback, options) {
  // parameter > extension > default
  const {verbose, noprefix, informat, outformat,
         inputFormat, outputFormat,
         dryrun, stripUrls} = options;

  // prepare parser and writer
  const parser = new Parser({ format: inputFormat });
  const tableWriterOptions = options;
  let writer;
  switch (outputFormat) {
  case 'application/json':
    writer = new ChartData(tableWriterOptions);
    break;
  case 'text/vnd.graphviz':
    writer = new GraphViz(tableWriterOptions);
    break;
  case 'application/vnd.org-mode':
    writer = new OrgModeTable(tableWriterOptions);
    break;
  case 'text/csv':
    writer = new CommaSeparatedTable(tableWriterOptions);
    break;
  case 'text/tab-separated-values':
    writer = new TabSeparatedTable(tableWriterOptions);
    break;
  default:
    writer = new Writer({ format: outputFormat });
  }

  parser.parse(inputData, (error, quad, prefixes) => {
    if (prefixes) {
      if (!noprefix) {
        writer.addPrefixes(prefixes);
      }
      verbose && console.error({prefixes});
    }
    if (quad) {
      if (isQuadPermitted(quad, options)) {
        writer.addQuad(quad);
        verbose && console.error({quad});
      } else {
        const reject = 'rejected';
        verbose && console.error({reject, quad});
      }

    } else if (error) {
      console.error('Error parsing input data:', error);
      process.exit(1);
    } else {
      // End of input; write the output
      writer.end(callback);
    }
  });
}

export { semconvert } ;
