# opening_hours_server.js

A little server daemon answering query‘s for [opening_hours][Key:opening_hours] and check if they can be evaluated. It was created to integrate opening_hours validation support into the [qat_script][] (see [pull request for integration](https://github.com/simone-f/qat_script/pull/5)).

It works by querying the requested data from the [OverpassAPI][], then fed it to [opening_hours.js][oh-lib] to see if it can be evaluated.

## Example query

http://openingh.openstreetmap.de/api/oh_interpreter?&tag=opening_hours&s=48.7785984&w=2.2257825&n=48.9165552&e=2.438069

http://openingh.openstreetmap.de/api/get_license

<!-- Security {{{ -->
## Security

Security is a key factor for this little program. All user input must be validated before processing it.

<!-- }}} -->

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
[oh-lib]: https://github.com/ypid/opening_hours.js
[qat_script]: https://github.com/simone-f/qat_script
[fossgis-project]: http://wiki.openstreetmap.org/wiki/FOSSGIS/Server/Projects/opening_hours.js
