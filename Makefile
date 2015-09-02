MAKE_OPTIONS ?= --no-print-directory

CHECK_URL ?= http://localhost:12355/api/oh_interpreter

default:
	@echo "See Makefile"

CHECK_TARGET_FILES = test.opening_hours.error.json \
	test.opening_hours.errorOnly.json \
	test.opening_hours.warnOnly.json \
	test.collection_times.error.json \
	test.collection_times.errorOnly.json \
	test.collection_times.warnOnly.json

test.opening_hours.error.json:
test.opening_hours.errorOnly.json:
test.opening_hours.warnOnly.json:
test.collection_times.error.json:
test.collection_times.errorOnly.json:
test.collection_times.warnOnly.json:

.PHONY: default check check-clean dev

check: $(CHECK_TARGET_FILES)
	@for check in $(CHECK_TARGET_FILES); do \
		$(MAKE) --always-make $(MAKE_OPTIONS) "$$check"; \
	done

check-clean:
	rm --force $(CHECK_TARGET_FILES)

dev:
	./ohs.js --debug --tcp-port 12355

serve:
	./ohs.js --tcp-port 12355

test.%.json:
	wget "$(CHECK_URL)?tag=$(shell echo "$@" | cut -d . -f 2)&filter=$(shell echo "$@" | cut -d . -f 3)&s=50.6553939&w=6.9842517&n=50.8111732&e=7.2673653" --output-document "$@" --quiet
