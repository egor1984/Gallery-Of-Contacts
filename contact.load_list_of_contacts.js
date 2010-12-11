
function load_list_of_contacts(uids,result_handler) {
	var counter = 0;
	for (var i = 0; i < uids.length; i++) {
		load_contact_details(unloaded_extended_contacts[i],0, function(contact) {
			if (contact.friends) {
				extended_contacts.push(contact);
			}
			counter++;
			if ( counter == unloaded_extended_contacts.length) {
					var groups_3_2nd = find_triples(extended_contacts);
					groups = merge_groups(4,11,groups_3_2nd);
						
					refreshGroupList();
			}
		}); 
		
	}
}	