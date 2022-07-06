#!/usr/bin/env bash

set -e

BASE_URL="https://firmware.darmstadt.freifunk.net/images/"

for BRANCH in "stable" "beta" "testing";
do
	echo "updating ${BRANCH}"

	mkdir -p images/${BRANCH}

	curl -sSfo images/${BRANCH}/gluon-factory-example.html "${BASE_URL}${BRANCH}/factory/"
	curl -sSfo images/${BRANCH}/gluon-other-example.html "${BASE_URL}${BRANCH}/other/"
	curl -sSfo images/${BRANCH}/gluon-sysupgrade-example.html "${BASE_URL}${BRANCH}/sysupgrade/"

done
