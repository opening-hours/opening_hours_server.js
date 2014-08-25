# opening_hours_server.js

A little server daemon answering query‘s for [opening_hours][Key:opening_hours] and check if they can be evaluated. It was created to integrate opening_hours validation support into the [qat_script][] (see [pull request for integration](https://github.com/simone-f/qat_script/pull/5)).

It works by querying the requested data from the [OverpassAPI][], then fed it to [opening_hours.js][oh-lib] to see if it can be evaluated.

## Example query

<!-- Security {{{ -->
## Security

Security is a key factor for this little program. All user input must be validated before processing it.

<!-- }}} -->
<!-- Authors {{{ -->
## Authors

* [Robin Schneider](https://github.com/ypid): Initial author and current maintainer.

<!-- }}} -->

[Key:opening_hours]: http://wiki.openstreetmap.org/wiki/Key:opening_hours
[OverpassAPI]: http://overpass-api.de/
[oh-lib]: https://github.com/ypid/opening_hours.js
[qat_script]: https://github.com/simone-f/qat_script
