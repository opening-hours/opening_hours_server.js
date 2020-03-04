# opening_hours_server.js

A little server daemon answering query‘s for [opening_hours][Key:opening_hours] and check if they can be evaluated. It was created to integrate opening_hours validation support into the [qat_script][] (see [pull request for integration](https://github.com/simone-f/qat_script/pull/5)).

It works by querying the requested data from the [OverpassAPI][], then fed it to [opening_hours.js][oh-lib] to see if it can be evaluated.

## `/api/oh_interpreter`

### Example query

http://openingh.openstreetmap.de/api/oh_interpreter?&tag=opening_hours&s=48.7785984&w=2.2257825&n=48.9165552&e=2.438069

http://openingh.openstreetmap.de/api/get_license

http://openingh.openstreetmap.de/api/get_source

<!-- Example response {{{ -->
### Example response

```javascript
{
    "version": 0.6,
    "generator": "Overpass API, modified by the opening_hours_server.js",
    "osm3s": {
        "timestamp_osm_base": "2014-09-08T17:54:02Z",
        "copyright": "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL."
    },
    "elements": [
        {
            "type": "node",
            "id": 418061336,
            "lat": 48.8666057,
            "lon": 2.3684684,
            "tags": {
                "addr:city": "Paris",
                "addr:housenumber": "13",
                "addr:postcode": "75011",
                "addr:street": "Avenue de la République",
                "name": "Chez Jean",
                "opening_hours": "Lundi-Dimanche : 7h-23h",
                "phone": "01 47 00 04 72",
                "shop": "convenience"
            },
            "tag_problems": {
                "opening_hours": {
                    "error": false,
                    "eval_notes": [
                        "Lundi <--- (S'il vous plaît utiliser l'abréviation \"Mo\" pour \"lundi\".)",
                        "Lundi-Dimanche <--- (S'il vous plaît utiliser l'abréviation \"Su\" pour \"dimanche\".)",
                        "Lundi-Dimanche : 7h <--- (Please omit \"h\" or use a colon instead: \"12:00-14:00\".)",
                        "Lundi-Dimanche : 7h-23h <--- (Please omit \"h\" or use a colon instead: \"12:00-14:00\".)",
                        "Lundi-Dimanche : 7h-23h <--- (Time range without minutes specified. Not very explicit! Please use this syntax instead \"07:00-23:00\".)",
                        "Lundi-Dimanche :  <--- (You have used the optional symbol <separator_for_readability> in the wrong place. Please check the syntax specification to see where it could be used or remove it.)"
                    ]
                }
            }
        }
        // [...]
    ]
}
```
<!-- }}} -->

### Query parameters

URL parm      | Default value      | Possible values and meaning
------------- | -------------      | -------------
s, w, n, e    | None, all required | [Bounding box](https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide#All_data_in_a_bounding_box)
tag           | None, required     | [Tag key](https://wiki.openstreetmap.org/wiki/Tags)
filter        | 'error'            | error: errors and warnings, errorOnly: only errors, warnOnly: only warnings

## `/api/validate`

Validates a given `opening_hour` value.

### Example `Mo-Su`
```json5
// curl 'localhost:12355/api/validate?value=Mo-Su'
{
    "value": "Mo-Su",
    "pretty_value": "Mo-Su",
    "warnings": [
        "Mo-Su <--- (This rule is not very explicit because there is no time selector being used. Please add a time selector to this rule or use a comment to make it more explicit.)"
    ]
}
```


### Example `Mo-Fr 13-15`
```json5
// curl 'localhost:12355/api/validate?value=Mo-Fr+13-15'
{
    "value": "Mo-Fr 13-15",
    "pretty_value": "Mo-Fr 13:00-15:00",
    "warnings": [
        "Mo-Fr 13-15 <--- (Time range without minutes specified. Not very explicit! Please use this syntax instead \"13:00-15:00\".)"
    ]
}
```

### Example `Mo-Suuu`
```json5
// curl 'localhost:12355/api/validate?value=Mo-Suuu'
{
    "value": "Mo-Suuu",
    "errors": [
        "Mo-S <--- (Unexpected token: \"-\" This means that the syntax is not valid at that point or it is currently not supported.) Mo-Suuu <--- (Bitte benutze die Schreibweise \",\" als Ersatz für \"u\".)"
    ]
}
```

### Query parameters
* `value` for the value to be validated
* all [configuration parameters](https://github.com/opening-hours/opening_hours.js/#library-api) supported by `opening_hours`, such as `mode`, `tag_key`, `map_value`, `warnings_severity`, `locale`, `additional_rule_separator`

<!-- Security {{{ -->

## Security

Security is a key factor for this little program. All user input must be validated before processing it.

<!-- }}} -->

## User agent for Overpass API

Requests made against the Overpass API contain the HTTP user agent `opening_hours_server.js, https://github.com/opening-hours/opening_hours_server.js` to allow to identify the opening_hours_server.js.

<!-- Authors {{{ -->
## Authors

* [Robin Schneider](https://github.com/ypid): Initial author and current maintainer.

<!-- }}} -->

<!-- Credits {{{ -->
## Credits ##

* Thanks to FOSSGIS for hosting a public instance of this service. See the [wiki][fossgis-project].

<!-- }}} -->

[Key:opening_hours]: http://wiki.openstreetmap.org/wiki/Key:opening_hours
[OverpassAPI]: http://overpass-api.de/
[oh-lib]: https://github.com/opening-hours/opening_hours.js
[qat_script]: https://github.com/simone-f/qat_script
[fossgis-project]: http://wiki.openstreetmap.org/wiki/FOSSGIS/Server/Projects/opening_hours.js
