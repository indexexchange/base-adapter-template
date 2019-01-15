#!/bin/sh

# $1 - partner name in kebab-case (index-exchange)
# $2 - partner type (htb)
# $3 - 4-letter pulse partner ID, i.e. the uppercase one (INDX)
# $4 - 4-letter target key partner ID, i.e. the lowercase one (indx) (OPTIONAL)
#
# Example: ./init.sh index-exchange htb INDX

PARTNER_NAME_KABAB=$(awk '{printf("%s", tolower($0))}' <<< $1)
PARTNER_NAME=$(awk -F '-' '{OFS=""; for(i=1; i<=NF; i++) { printf("%s%s", toupper(substr($i, 1, 1)), substr($i, 2))}}' <<< $PARTNER_NAME_KABAB)
PARTNER_TYPE_KABAB=$(awk '{printf("%s", tolower($0))}' <<< $2)
PARTNER_TYPE=$(awk '{printf("%s%s", toupper(substr($0, 1, 1)), substr($0, 2))}' <<< $PARTNER_TYPE_KABAB)
PARTNER_STATS_ID=$(awk '{printf("%s", toupper($0))}' <<< $3)
PARTNER_STATS_ID_LOWER=${4:-$(awk '{printf("%s", tolower($0))}' <<< $3)}

echo "Applying template values:"
echo "  partner-name: $PARTNER_NAME_KABAB"
echo "  partnertype: $PARTNER_TYPE_KABAB"
echo "  PartnerName: $PARTNER_NAME"
echo "  PartnerType: $PARTNER_TYPE"
echo "  PARTNERID: $PARTNER_STATS_ID"
echo "  partnerid: $PARTNER_STATS_ID_LOWER"


# Apply template file
# $1 - template file
# $2 - output destination
function apply() {
    # Using temporary files as there is no portable way of doing `sed -i`
    sed -E -e "s/%%partner-name%%/$PARTNER_NAME_KABAB/g" -e "s/%%partnertype%%/$PARTNER_TYPE_KABAB/g" \
        -e "s/%%PartnerName%%/$PARTNER_NAME/g" -e "s/%%PartnerType%%/$PARTNER_TYPE/g" \
        -e "s/%%PARTNERID%%/$PARTNER_STATS_ID/g" -e "s/%%partnerid%%/$PARTNER_STATS_ID_LOWER/g" "$1" > /tmp/sspt-tmp-file
    rm -f "$1"
    mv /tmp/sspt-tmp-file "$2"
}

apply README.md README.md
apply partner-exports.js $PARTNER_NAME_KABAB-$PARTNER_TYPE_KABAB-exports.js
mv    partner-validator.js $PARTNER_NAME_KABAB-$PARTNER_TYPE_KABAB-validator.js
apply partner-module.js $PARTNER_NAME_KABAB-$PARTNER_TYPE_KABAB.js
mv    partner-system-tests.js $PARTNER_NAME_KABAB-$PARTNER_TYPE_KABAB-system-tests.js
apply DOCUMENTATION.md DOCUMENTATION.md


echo "Done."

# remove this script on completion
rm -f init.sh
