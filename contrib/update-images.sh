#!/usr/bin/env bash

set -e

BASE_URL=${BASE_URL:-"https://firmware.darmstadt.freifunk.net/images/"}
BRANCHES=${BRANCHES:-"stable beta testing"}

for BRANCH in $BRANCHES;
do
	echo "updating ${BRANCH} from ${BASE_URL}"

	mkdir -p images/${BRANCH}

	curl -sSfo images/${BRANCH}/gluon-factory-example.html "${BASE_URL}${BRANCH}/factory/"
	curl -sSfo images/${BRANCH}/gluon-other-example.html "${BASE_URL}${BRANCH}/other/"
	curl -sSfo images/${BRANCH}/gluon-sysupgrade-example.html "${BASE_URL}${BRANCH}/sysupgrade/"

done
