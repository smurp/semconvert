import { Parser, Writer, Store } from 'n3';

class UniqueArray extends Array {
  pushIndexOf(key) {
    if (this.indexOf(key)==-1) {
      this.push(key);
    }
    return this.indexOf(key);
  }
}

class TableWriter {
  constructor(options={}) {
    this.options = options;
    this.store = new Store();
    this.line_prefix = '';
    this.line_postfix = '';
    this.col_delim = '';
    this.col_prefix = '';
    this.col_postfix = '';
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

function covers(passOrDenyRegexList, value) {
  for (const re of passOrDenyRegexList) {
    const regex = new RegExp(re);
    if (regex.test(value)) return true;
  }
  return false;
}

function isQuadPermitted(quad, options) {
  const {denySubjLike, passSubjLike, passPredLike, denyPredLike} = options;
  if ((denySubjLike && covers(denySubjLike, quad.subject.value))
      || (denyPredLike && covers(denyPredLike, quad.predicate.value))
      || (passSubjLike && ! covers(passSubjLike, quad.subject.value))
      || (passPredLike && ! covers(passPredLike, quad.predicate.value))) {
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
  const tableWriterOptions = {stripUrls};
  let writer;
  switch (outputFormat) {
  case 'application/vnd.org-mode':
    writer = new OrgModeTable(tableWriterOptions);
    break;
  case 'text/tab-separated-values':
    writer = new TabSeparatedTable(tableWriterOptions);
    break;
  case 'text/csv':
    writer = new CommaSeparatedTable(tableWriterOptions);
    break;
  case 'application/json':
    writer = new ChartData(tableWriterOptions);
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