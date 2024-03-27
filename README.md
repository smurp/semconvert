
## semconvert -- transform, filter and process RDF-star

## semconvert -h

```
Usage: semconvert [options] <infile> <outfile>

Converts between various RDF and RDF-star syntaxes such as
  nq|nt|rdf|trig|ttl|ttl+star|trig+star|rdf+star
and can also convert to
  application/vnd.org-mode (.org)
  application/json (.json) as used by https://chartjs.org/
  text/csv (.csv)
  text/tab-separated-values (.tsv)
  text/vnd.graphviz (.dot)

Arguments:
  infile                             the input file (or - for stdin)
  outfile                            the output file (or - for stdout)

Options:
  -o, --outformat <OF>               the output format, default text/turtle
  -i, --informat <IF>                the input format, default text/turtlestar
  -v, --verbose                      show details
  -n, --noprefix                     do not output prefixes
  -d, --dryrun                       show what will happen but do nothing
  -s, --stripUrls                    strip http://x.co/wtf#eg http://x.co/a/eg
                                     http://eg/ to eg
  --squelch                          suppress labels in some outformats, eg
                                     .dot
  --ds, --denySubjLike <RegEx...>    ignore subjects like
  --ps, --passSubjLike <RegEx...>    permit subjects like
  --dp, --denyPredLike <RegEx...>    ignore predicates like
  --pp, --passPredLike <RegEx...>    permit predicates like
  --do, --denyObjLike <RegEx...>     ignore objects like
  --po, --passObjLike <RegEx...>     permit objects like
  --de, --denyEntityLike <RegEx...>  ignore subjects and objects like
  --pe, --passEntityLike <RegEx...>  permit subjects and objects like
  --dot-header <HEAD>                add HEAD at the top of GraphViz output
  -h, --help                         display help for command

Examples:
     # input.ttl
     @prefix : <http://example.com/a/path/> .
     :S1 Pred1 1.0; :Pred2 2.0; :Pred3 "one" .
     :S2 Pred1 3.0; :Pred2 4.0; :Pred3 "two" .
     :S3 Pred1 5.0; :Pred2 6.0; :Pred3 "tre" .

  semconvert input.trig output.nq # nothing to stdout
    trivial conversion from TRIG to N-Quads

  semconvert --denySubjLike Mo 'C.*rly' -- Buddies.ttl noMoOrCurly.ttl
    convert Turtle to Turtle but skip subjects matching Mo or C.*rly
    guard special characters with ''
    use -- to force the end of option processing

  semconvert --stripUrls --outformat=org  input.ttl -
       |  |Pred1|Pred2|Pred3|
       |S1|  1.0|  2.0|  one|
       |S2|  3.0|  4.0|  two|
       |S3|  5.0|  6.0|  tre|
    generate Org-Mode table output, striping url ugliness

  semconvert --informat=ttl+star --outformat=trig  input.ttl -
    if the outfile is - (ie stdout) then explicit --outformat
    force the --informat if there is RDFstar content

  semconvert --denySubjLike S2 --denyPredLike Pred1 Pred3  \
             --outformat=org --stripUrls input.ttl -
       |  |Pred2|
       |S1|  2.0|
       |S3|  6.0|
    Subj or Pred can be passed or denied by space-delimited RegExes

  semconvert --ps S2 --pp Pred1 Pred3 -oorg -s - - < input.ttl
       |  |Pred1|Pred3|
       |S2|  3.0|  two|
    Same as previous example but abbreviated and pass/deny inverted!
    Also read from stdin and, in this case, rely on the informat default.

  semconvert prov-o-ex2.ttl prov-o-ex2.dot && \
         dot -Tpng prov-o-ex2.dot > prov-o-ex2.png
    Generate GraphViz DOT output (and then render it)

  semconvert --squelch prov-o-ex2.ttl prov-o-ex2.dot && \
         dot -Tpng prov-o-ex2.dot > prov-o-ex2.png
    Generate GraphViz DOT output but without node or edge labels

  semconvert --dot-header 'node[color="blue"];edge[color="red"];label="Hi";' \
         - out.dot
    Set a graph label and defaults for nodes and edges
```
