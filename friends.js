var zoom = 21600;
var PI = Math.PI;
var oid = 0;
setTimeout( function() {
}, 500);

function get_contact_url( uid) {
	return "http://vkontakte.ru/id" + uid;
}

var vk_loader = new contact_loader();

var getProfiles_traits = {
		"method_name" : "getProfiles"
		,"parameters_builder" : function(details_requests) {
			var uids = "";
			for (var i = 0; i < details_requests.length; i++) {
				if (i!=0) {
					uids += ",";
				}
				uids += details_requests[i].parameters.contact.uid;
			}				
			return {uids:uids, fields:"uid,first_name,last_name,photo"};
		}
		,"response_handler" : function(parameters,response) {
			for (var key in response){
				if (key != "uid") {
					parameters.contact[key] = response[key];
				}
			}
		
		}
		,"max_sum" : 240};


var friends_getMutual_traits = {"method_name" : "execute", "parameters_builder" : function(details_requests) {
		var code = "var ret = [";
		for (var i = 0; i < details_requests.length; i++) {
			if (i!=0) {
				code += ",";
			}
			code += "API.friends.getMutual({target_uid:" + details_requests[i].parameters.contact_1.uid
								+ ", source_uid: " + details_requests[i].parameters.contact_2.uid + "})";
		}				
		code += "]; return ret;";
		return {api_id:"1918079",code:code,v:"3.0"};			
	}
	,"response_handler" : function(parameters,response) {
		if (!parameters.contact_1.mutual_friends) {
			parameters.contact_1.mutual_friends = {};
		}
		if (!parameters.contact_2.mutual_friends) {
			parameters.contact_2.mutual_friends = {};
		}
		if (response.constructor != Array) {
			response = [];
		}
		for (var uid_index = 0;uid_index < response.length;uid_index++) {
			var mutual_friend_uid = response[uid_index];
			if (!parameters.contact_1.mutual_friends[parameters.contact_2.uid]) {
				parameters.contact_1.mutual_friends[parameters.contact_2.uid] = [];
			}
			if (index_of(parameters.contact_1.mutual_friends[parameters.contact_2.uid]
					,mutual_friend_uid) == -1) {
				parameters.contact_1.mutual_friends[parameters.contact_2.uid].push(mutual_friend_uid);					
			}
			if (!parameters.contact_1.mutual_friends[mutual_friend_uid]) {
				parameters.contact_1.mutual_friends[mutual_friend_uid] = [];
			}
			if (index_of(parameters.contact_1.mutual_friends[mutual_friend_uid]
					,parameters.contact_2.uid) == -1) {
				parameters.contact_1.mutual_friends[mutual_friend_uid].push(parameters.contact_2.uid);					
			}
			
		}
	}
	,"max_sum" : 25};


var call_counter = 0;
var l = -1;
var clusters = new Array();
var loaded_contacts = {};


function get_app_user_uid()	{
//return 5843475;
//return 14769060;
//return 3469711;
//return 1895846;
//return 4430857;

	return Number(getUrlParameter(window.location.href, "user_id")); 
}


function indexOf(arr, pred) {
	var index = 0;
	while (index < arr.length && !pred(arr[index])) {
		index++;
	}
	if (index == arr.length) {
		return -1;
	}
	return index;
}

function uids_are_friends(user, uid1, uid2) {
// Contacts can hide their friends information, so we will check both of them
				
	return user.mutual_friends 
	&& (user.mutual_friends[uid1] 
	&& index_of(user.mutual_friends[uid1],uid2) != -1 
	|| user.mutual_friends[uid2] && index_of(user.mutual_friends[uid2],uid1) != -1);
}


function find_distinct_values(uids1,uids2) {
	//we assume groups members are sorted
	
	var distinct_values = new Array();
	
	var index1 = 0;
	var index2 = 0;
	while (index1 < uids1.length || index2 < uids2.length) {
		if (index1>=uids1.length) {
			distinct_values.push(uids2[index2]);
			index2++;
		} else {
			if (index2>=uids2.length) {
				distinct_values.push(uids1[index1]);
				index1++;
			} else { 
				if (uids1[index1] < uids2[index2]) {
					distinct_values.push(uids1[index1]);
					index1++;
				} else {
					if (uids1[index1] > uids2[index2]) {
						distinct_values.push(uids2[index2]);
						index2++;
					} else {
						if (uids1[index1] == uids2[index2]) {
							index1++;
							index2++;
						}
					}
				}
			}
		}
	
	}
	
	return distinct_values;
}


function merge_unique(uids1, uids2) {
	//we assume groups members are sorted
	
	var uniques = new Array();
	
	var index1 = 0;
	var index2 = 0;
	while (index1 < uids1.length || index2 < uids2.length) {
		var next_uid;
		if (index1 < uids1.length && (index2 >= uids2.length || uids1[index1] < uids2[index2])) {
			next_uid = uids1[index1];
			index1++;
		} else {
			next_uid = uids2[index2];
			index2++;
		}
		if (uniques.length == 0 || uniques[uniques.length - 1]!=next_uid) {
			uniques.push(next_uid);
		}
	}
	
	return uniques;
}

function concat_members_names(members) {
	var group_name = "";
	for (var n = 0; n < members.length; n++) {
		group_name = group_name + members[n].first_name + (n == (members.length - 1) ? "" : " ");
	}
	return group_name;
}
function merge_to_next_size(user,groups){
	var groups_of_next_size = {};
	for (var index1=0;index1<groups.length;index1++){
		var group1 = groups[index1];
		for (var index2=index1+1;index2<groups.length;index2++){
			var group2 = groups[index2];
			var distinct_values = find_distinct_values(group1.uids,group2.uids);
			if (distinct_values.length==2 && uids_are_friends(user,distinct_values[0],distinct_values[1])){
				group1.used_in_merged = true;
				group2.used_in_merged = true;
				var uids = merge_unique(group1.uids,group2.uids);
				var group_of_next_size = new Object({uids:uids,used_in_merged:false});
				
				groups_of_next_size[uids] = group_of_next_size;
			}
		}
	}
	var groups_array = new Array();
	for (var group_key in groups_of_next_size) {
		groups_array.push(groups_of_next_size[group_key]);
	}
	return groups_array;
}


function index_of_same_group(groups,group_1) {
	return indexOf(groups,function(group) {
			if (group_1.uids.length !=group.uids.length){
				return false;
			}
			for (var member_index=0;member_index<group.uids.length;member_index++) {
				if (group_1.uids[member_index]!=group.uids[member_index]){
					return false;
				}
			}
			return true;
		});
}
	
function merge_groups(user,group_size_begin,group_size_end,groups_for_merge) {
	var all_merged_groups = new Array();
	for (var i=group_size_begin;i<=group_size_end;i++) {
		var tmp_groups_for_merge = merge_to_next_size(user,groups_for_merge);
		for (var j = 0; j < groups_for_merge.length;j++) {
			if (!groups_for_merge[j].used_in_merged) {
				all_merged_groups.push(groups_for_merge[j]);
			}
		}
		groups_for_merge = tmp_groups_for_merge;
	}	
	for (var i = 0; i < groups_for_merge.length;i++) {
		all_merged_groups.push(groups_for_merge[i]);
	}
	return all_merged_groups;
}
	

	
function find_dublicates_in_sorted_arrays(array_1,array_2,comparator) {
	var dublicates = new Array();
	var index_1 = 0;
	var index_2 = 0;
	while (index_1 < array_1.length && index_2 < array_2.length) {
		var compare_result = comparator(array_1[index_1],array_2[index_2]);
		if (compare_result == 0) {
			dublicates.push(array_1[index_1]);
			index_1++;
			index_2++;
		}
		else {
			if (compare_result < 0) {
				index_1++;
			}
			else {
				index_2++;
			}
		}
	}
	return dublicates;
}
	
	
function find_triples(user) {
	var groups_3 = new Array();
	
	for (var uid_of_friend_of_user  in user.friends){
		var mutual_friends = user.mutual_friends[uid_of_friend_of_user];
		if (mutual_friends) {
			for (var i = 0; i < mutual_friends.length; i++) {
				var triple = new Array();
				triple.push(user.uid);
				triple.push(Number(uid_of_friend_of_user));
				triple.push(mutual_friends[i]);
				triple.sort(function(uid_1,uid_2) { return uid_1 - uid_2;});				

				var group = new Object({uids: triple,used_in_merged:false});
				if (index_of_same_group(groups_3,group)==-1) {
					groups_3.push(group);
				}				
			}
		}
	}
	return groups_3;
}
	
function get_distinct_uids(groups){
	var uids = {};
	for (var i = 0; i<groups.length;i++) {
		for (var j = 0;j<groups[i].uids.length;j++) {
			var uid = groups[i].uids[j];
			uids[uid] = true;
		}
	}
	return uids;
}

function get_intersected_array(array_1,array_2) {
	
	var array_1_as_object = {};
	for (var element_index = 0; element_index < array_1.length;element_index++) {
		array_1_as_object[array_1[element_index]] = true;
	}
	
	var result = [];
	
	for (var element_index=0;element_index<array_2.length;element_index++) {
		var element = array_2[element_index];
		if (array_1_as_object[element]) {
			result.push(element);
		}
	}
	return result;
}


function get_substracted_array(substractable,substraction) {
	
	var substractable_as_object = {};
	for (var element_index = 0; element_index < substractable.length;element_index++) {
		substractable_as_object[substractable[element_index]] = true;
	}
	for (var element_index=0;element_index<substraction.length;element_index++) {
		delete substractable_as_object[substraction[element_index]];
	}
	var substracted_array = [];
	for (var element in substractable_as_object) {
		substracted_array.push(element);
	}
	substracted_array.sort(function(element_1,element_2) { return element_1 - element_2;});
	return substracted_array;
}


function get_common_uids(groups,group_indexes) {
	var common_uids = [];
	if (group_indexes.length >= 2) {
		common_uids = groups[group_indexes[0]].uids;
		for (var group_indexes_index = 1; group_indexes_index < group_indexes.length; group_indexes_index++) {
			common_uids = find_dublicates_in_sorted_arrays(common_uids,groups[group_indexes[group_indexes_index]].uids
				, function(uid_1,uid_2) { return uid_1 - uid_2;});
		}
	}
	return common_uids;
}


function process_output(user) {
	if (user.mutual_friends) {
		var groups_3 = find_triples(user);
		var groups = merge_groups(user, 4,11,groups_3);
		
		var uids = get_distinct_uids(groups);
		var profiles_left_to_load = 0;
		for (var uid in user.friends){
			if (!loaded_contacts[uid]) {
				loaded_contacts[uid] = {uid:uid};
			}
			var contact = loaded_contacts[uid];
			if (!contact.first_name) {
				profiles_left_to_load++;
				vk_loader.load( getProfiles_traits, {contact:contact}, function(parameters,result_message){
					profiles_left_to_load--;
					if (profiles_left_to_load == 0) {
						draw_grid_of_friends(user);
					}
				});
			}
					
		}
	}
}

function delete_value_in_grid(grid,index) {
	if (grid[index[0]]) {
		delete grid[index[0]][index[1]];
		var count_of_indexes;
		for (var indexes in grid[index[0]]) {
			count_of_indexes++;
		}
		if (count_of_indexes == 0) {
			delete grid[index[0]];
		}
	}
}

function get_index_in_grid(grid,value) {
//may be optimized	
	var index = undefined;
	for_each_index_in_grid(grid,function(current_index) {		
		if (get_value_in_grid(grid,current_index) == value) {

			index = current_index;
		}
	});
	return index;
}

function get_value_in_grid(grid, index) {
	if (grid[index[0]]) {
		return grid[index[0]][index[1]];		
	}
	else {
		return undefined;
	}
}

function set_value_in_grid(grid,index,value) {
	if (!grid[index[0]]) {
		grid[index[0]] = [];
	}
	grid[index[0]][index[1]] = value;	
}

function for_each_index_in_grid(grid,callback) {
	for (var grid_index_x in grid) {
		for (var grid_index_y in grid[grid_index_x]) {
			callback([Number(grid_index_x),Number(grid_index_y)]);
		}
	}
}

function get_sorted_values_in_grid(grid) {
	var values = [];
	for_each_index_in_grid(grid,function(index) {
		values.push(get_value_in_grid(grid,index));
	});
	values.sort(function(index_1,index_2) {
		return index_2 - index_1;
	});
	return values;
}

function add_mutual_friends_recursively(user,uid,list,excludes) {
	var mutual_friends = user.mutual_friends[uid];
	if (mutual_friends) {
		for (var i = 0; i < mutual_friends.length; i++) {
			var mutual_friend_uid = mutual_friends[i];
			if (!excludes[mutual_friend_uid]) {
				list.push(mutual_friend_uid);
				excludes[mutual_friend_uid] = true;
				add_mutual_friends_recursively(user,mutual_friend_uid,list,excludes);
			}
		}
	}
}

function create_grid_of_friends(user,group, maximum_width) {
	var grid = {};
	for (var i = 0; i < group.length; i++) {
		var friend_uid = group[i];
		var indexes_of_placed_contacts = [];
		var mutual_friends = user.mutual_friends[friend_uid];
		if (mutual_friends) {
			for (var j = 0; j < mutual_friends.length; j++) {
				var uid_of_mutual_friend = mutual_friends[j];
				var index_of_mutual_friend = get_index_in_grid(grid,uid_of_mutual_friend);

				if (index_of_mutual_friend) {
					indexes_of_placed_contacts.push(index_of_mutual_friend);
				}						
			}			
		}

		var middle_coordinate = get_middle_coordinate(indexes_of_placed_contacts);
		var index_of_friend = get_nearest_free_index(grid,middle_coordinate, maximum_width);		
		set_value_in_grid(grid,index_of_friend, friend_uid);		
	}
	return grid;
}

function get_shifted_grid(grid,lower_bound) {

	var shifted_grid = {};
	var bounds = find_bounding_indexes(grid);
	var horizontal_shift = lower_bound[0] - bounds[0][0];
	var vertical_shift = lower_bound[1] - bounds[0][1];
	
	for_each_index_in_grid(grid, function(grid_index) {
		var shifted_index = [grid_index[0] + horizontal_shift
                             ,grid_index[1] + vertical_shift];
		var value = get_value_in_grid(grid,grid_index);
		set_value_in_grid(shifted_grid,shifted_index,value);
	});
	return shifted_grid;
}

function get_bounds_of_area(area) {
	var area_bounds = [[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY] 
						,[Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY]];
	for (var i = 0; i < area.length; i++) {
		var bounds = area[i];

		if (bounds[0][0] < area_bounds[0][0]) {
			area_bounds[0][0] = bounds[0][0];
		}
		if (bounds[0][1] < area_bounds[0][1]) {
			area_bounds[0][1] = bounds[0][1];
		}
		if (bounds[1][0] > area_bounds[1][0]) {
			area_bounds[1][0] = bounds[1][0];
		}
		if (bounds[1][1] > area_bounds[1][1]) {
			area_bounds[1][1] = bounds[1][1];
		}
	}
	return area_bounds;
}

function ranges_are_intersected(range_1, range_2) {
	return range_1[1] >= range_2[0] && range_1[0] < range_2[1];
}

function bounds_are_intersected(bounds_1, bounds_2) {
	return ranges_are_intersected([bounds_1[0][0], bounds_1[1][0]], [bounds_2[0][0], bounds_2[1][0]])
		&& ranges_are_intersected([bounds_1[0][1], bounds_1[1][1]], [bounds_2[0][1], bounds_2[1][1]]);
}

function bounds_intersect_area(bounds, area, delta) {
	for (var i=0; i < area.length; i++) {
		var area_bounds = [[area[i][0][0] - delta, area[i][0][1] - delta]
						,[area[i][1][0] + delta, area[i][1][1] + delta]];
		if (bounds_are_intersected(bounds, area_bounds)) {
			return true;
		}
	}
	return false;	
}


function get_lower_bound_for_grid(grids_positions,dimensions_of_grid,maximum_width,delta) {
	if (grids_positions.length == 0) {
		return [delta,delta];
	}
	
	for (var i = 0; i < grids_positions.length; i++) {
		var lower_bound = [grids_positions[i][1][0] + delta, grids_positions[i][0][1]];
		var upper_bound = [lower_bound[0] + dimensions_of_grid[0], lower_bound[1] + dimensions_of_grid[1]];
		if (upper_bound[0] <= maximum_width) {
			if (!bounds_intersect_area([lower_bound, upper_bound], grids_positions, delta)) {
				return lower_bound;
			}
		}
	}

	for (var i = 0; i < grids_positions.length; i++) {
		var lower_bound = [grids_positions[i][0][0], grids_positions[i][1][1] + delta];
		var upper_bound = [lower_bound[0] + dimensions_of_grid[0], lower_bound[1] + dimensions_of_grid[1]];
		if (upper_bound[0] <= maximum_width) {
			if (!bounds_intersect_area([lower_bound, upper_bound], grids_positions, delta)) {
				return lower_bound;				
			}
		}
	}
	
	for (var i = 0; i < grids_positions.length; i++) {
		var lower_bound = [grids_positions[i][1][0] + delta, grids_positions[i][1][1] + delta];
		var upper_bound = [lower_bound[0] + dimensions_of_grid[0], lower_bound[1] + dimensions_of_grid[1]];
		if (upper_bound[0] <= maximum_width) {
			if (!bounds_intersect_area([lower_bound, upper_bound], grids_positions, delta)) {
				return lower_bound;				
			}
		}
	}

	
	return [get_bounds_of_area(grids_positions)[1][0] + delta
	        ,get_bounds_of_area(grids_positions)[1][1] + delta];
	
}

function draw_grid_of_friends(user) {

	
	var width_of_cell = 50;
	var width_of_border = 5;
	var width_of_window = 606;
	
	var grids = [];
	var excludes = {};
	for (var uid_string in user.friends) {
		var uid = Number(uid_string);
		if (!excludes[uid]) {
			excludes[uid] = true;
			var group = [uid];
			add_mutual_friends_recursively(user,uid,group,excludes);
			group.sort(function(friend_1,friend_2) {
				var counter_1 = user.mutual_friends[friend_1] ? user.mutual_friends[friend_1].length : 0;
				var counter_2 = user.mutual_friends[friend_2] ? user.mutual_friends[friend_2].length : 0;
				var delta_between_counters = counter_2 - counter_1;
				return delta_between_counters != 0 ? delta_between_counters : friend_2 - friend_1;
			});
			grids.push(get_shifted_grid(create_grid_of_friends(user,group, width_of_window/(width_of_cell + 1.5*width_of_border)),[0,0]));
		}
	}
	
	grids.sort(function(grid_1, grid_2) {
		var bounds_of_grid_1 = get_bounds_of_grid(grid_1);
		var dimensions_of_grid_1 = [bounds_of_grid_1[1][0] - bounds_of_grid_1[0][0]
		,bounds_of_grid_1[1][1] - bounds_of_grid_1[0][1]];
		var bounds_of_grid_2 = get_bounds_of_grid(grid_2);
		var dimensions_of_grid_2 = [bounds_of_grid_2[1][0] - bounds_of_grid_2[0][0]
		,bounds_of_grid_2[1][1] - bounds_of_grid_2[0][1]];
		
		var difference = dimensions_of_grid_2[0]*dimensions_of_grid_2[1] - dimensions_of_grid_1[0]*dimensions_of_grid_1[1];
		if (difference != 0) {
			return difference;
		} else {
			var values_1 = get_sorted_values_in_grid(grid_1);
			var values_2 = get_sorted_values_in_grid(grid_2);
			while (values_1[values_1.length - 1] == values_2[values_2.length - 1]) {
				values_1.pop();
				values_2.pop();
			}
			return values_2[values_2.length - 1] - values_1[values_1.length - 1];
		}
	});

//	var paper = window.Raphael("canvas", width_of_window, 0);
    var paper = R_engine_create("canvas", width_of_window, 0);
	

	
	var grids_positions = [];

	var maximum_y = 0;
	
	for (var i = 0; i < grids.length; i++) {
		var grid = grids[i];
		var bounds = get_bounds_of_grid(grid);
		var dimensions_of_grid = [bounds[1][0] - bounds[0][0]
		,bounds[1][1] - bounds[0][1]];
		var lower_bound_for_grid = get_lower_bound_for_grid(grids_positions
							,dimensions_of_grid,width_of_window/(width_of_cell + width_of_border),0.2);
		var upper_bound_for_grid = [lower_bound_for_grid[0] + dimensions_of_grid[0]
									,lower_bound_for_grid[1]+ dimensions_of_grid[1]];
		grids_positions.push([lower_bound_for_grid, upper_bound_for_grid]);

		for_each_index_in_grid(grid, function(grid_index) {
			var uid = get_value_in_grid(grid,grid_index);
			var coordinate = get_coordinate(grid_index);
			
			
			var shifted_coordinate = [coordinate[0] -bounds[0][0] + lower_bound_for_grid[0]
										,coordinate[1] -bounds[0][1] + lower_bound_for_grid[1]];
			
			var expand_edge = [];
			
			var shifts_counter_clockwise = [[-1,0],[0,1],[1,1],[1,0],[0,-1],[-1,-1]];
			
			for (var shift_index = 0; shift_index < shifts_counter_clockwise.length; shift_index++) {
				var index_x = grid_index[0] + shifts_counter_clockwise[shift_index][0];
				var index_y = grid_index[1] + shifts_counter_clockwise[shift_index][1];
				expand_edge.push(get_value_in_grid(grid, [ index_x, index_y]) == undefined);							
			}
			
			var position = {x:(width_of_cell + width_of_border)*shifted_coordinate[0]
							, y:(width_of_cell + width_of_border)*shifted_coordinate[1]};
			
			draw_contact_icon(paper,uid,position, width_of_cell, expand_edge);
			if (position.y > maximum_y) {
				maximum_y = position.y;
				var height_of_window = maximum_y + width_of_cell;
                                paper.canvas.style.height = height_of_window + "px";
//                              cs.clip = "rect(0 " + 606 + " " + height + " 0)";
			}
		});
		
		
	}
	VK.callMethod("resizeWindow", 606, maximum_y + width_of_cell);				

	
	
}



function getUrlParameter(url, parameterName) {
	var param_str = "&" + parameterName + "=";
	
	var val_str_begin = url.indexOf(param_str) + param_str.length;

	var val_str_end = url.indexOf("&", val_str_begin);
	return url.substr(val_str_begin, val_str_end - val_str_begin);
}

//autorun on page load
setTimeout( function() {

	
	VK.Modules.load('md5', function() {
	});
	
	var userContact = {uid:get_app_user_uid()};

	loaded_contacts[userContact.uid] = userContact;

	
	var result_string = getUrlParameter(window.location.href, "api_result");
	var result = window.JSON.parse(unescape(result_string));
	if (!result.response) {
		if (result.error) {
			alert(result.error.error_msg);
			return;
		}
	}
	userContact.friends = {};
	for (var uid_index=0;uid_index<result.response.length;uid_index++) {
		userContact.friends[result.response[uid_index]]=true;
	}

//	load_friends_of_contact_recursive(userContact, 0,function(contact) {
		
		var friends_left_to_process = 0;
		for (var uid in userContact.friends) {
			friends_left_to_process++;
			var friend = {uid:Number(uid)};
			vk_loader.load(friends_getMutual_traits,{contact_1:userContact,contact_2:friend},function(parameters,result_message) {
				if (result_message == "Success" 
					&& parameters.contact_2.mutual_friends 
					&& parameters.contact_2.mutual_friends[parameters.contact_1.uid]){
					loaded_contacts[parameters.contact_2.uid] = parameters.contact_2;
				}
				friends_left_to_process--;
				if (friends_left_to_process == 0) {
					process_output(userContact);									

					
				}				
			});
		}
//	});
	

}, 0);

		
		
function clone_graph_without_node(graph, node_id) {
		var cloned_graph = {};
		for (var connection_node_id in graph) {
			if (connection_node_id != node_id) {
				var connections = [];
				for (var connection_index = 0; connection_index < graph[connection_node_id].connections.length;connection_index++) {
					var connection_id = graph[connection_node_id].connections[connection_index];
					if (connection_id != node_id) {
						connections.push(connection_id);
					}
				}					
				cloned_graph[connection_node_id] = {connections : connections};
			}
		}
		return cloned_graph;
	}
	
	function find_node_with_minimum_connections(graph) {
		var minimum = 0;
		while (true) {
			for (var uid in graph) {
				if (graph[uid].connections.length == minimum) {
					return Number(uid);
				}
			}
			minimum++;
		}
	}
	
	function merge_segments_with_same_uid_at_tip(segments,graph) {
		for (var segment_index_1 = 0; segment_index_1 < segments.length;segment_index_1++) {
			var segment_1 = segments[segment_index_1];

//algorithm may be improved by different handling of segments with same uids on tips
			if (segment_1[0] == segment_1[segment_1.length - 1]) {
				segment_1.pop();
				return {segments_are_changed:true,graph:graph};
			}
			for (var segment_index_2 = 0; segment_index_2 < segments.length;segment_index_2++) {
				if (segment_index_2 != segment_index_1) {
					var segment_2 = segments[segment_index_2];
					if (segment_1[segment_1.length - 1] == segment_2[0]
						|| segment_1[segment_1.length - 1] == segment_2[segment_2.length - 1]) {
						segment_1.reverse();
					}
					if (segment_2[0] == segment_1[0]) {
						segment_2.reverse();
					}
					if (segment_1[0] == segment_2[segment_2.length - 1]) {
						segment_2.pop();
						var new_graph = clone_graph_without_node(graph,segment_1[0]);
						segments[segment_index_1] = segment_2.concat(segment_1);
						segments.splice(segment_index_2,1);
						return {segments_are_changed:true,graph:new_graph};
					}
				}
			}
		}
		return {segments_are_changed:false,graph:graph};
	}
	
	function form_graph_of_uids_connections(edges_counter,uids) {
		var existing_segments = {};
		for (var uid_index = 0;uid_index < uids.length; uid_index++) {
			var uid_1 = uids[uid_index];
			var connections = [];
			for (var uid_2_index = 0; uid_2_index < uids.length;uid_2_index++) {
				var uid_2 = uids[uid_2_index];
				if (uid_1 != uid_2 && edges_counter[[uid_1,uid_2]]) {
					connections.push(uid_2);
				}
			}
			existing_segments[uid_1] = {connections : connections};
		}
		return existing_segments;
	}
	

	
	function find_bounding_indexes(grid) {
		var lower_bound = [Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY]; 
		var upper_bound = [Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY];
		for_each_index_in_grid(grid,function(grid_index) {
			if (lower_bound[0] > grid_index[0]) {
				lower_bound[0] = grid_index[0];
			}
			if (lower_bound[1] > grid_index[1]) {
				lower_bound[1] = grid_index[1];
			}
			if (upper_bound[0] < grid_index[0]) {
				upper_bound[0] = grid_index[0];
			}
			if (upper_bound[1] < grid_index[1]) {
				upper_bound[1] = grid_index[1];
			}			
		});
		return [lower_bound,upper_bound];
	}

	function get_distance(coordinate_1,coordinate_2) {
		var delta = [coordinate_2[0]-coordinate_1[0]
					,coordinate_2[1]-coordinate_1[1]];		
		return Math.sqrt(delta[0]*delta[0] + delta[1]*delta[1]);
	}
	
	function index_fits_grid(grid, index, maximum_width) {
		
		var bounds_of_area = get_bounds_of_area([get_bounds_of_grid(grid)
							                       , get_bounds_of_cell(index)]);
		return !get_value_in_grid(grid,index) 
			&& bounds_of_area[1][0] - bounds_of_area[0][0] < maximum_width;
	}
	
	function get_nearest_free_index(grid,coordinate, maximum_width) {
		
		var index = get_index(coordinate);

		if (index_fits_grid(grid, index, maximum_width)) {
			return index;
		}
		var r = 1;
		var nearest_found_free_index = undefined;
		var current_index = index;
		while (true) {
			current_index = [current_index[0],current_index[1] + 1];
			var nearest_found_index_in_cycle = current_index;

			var shifts = [[1,-1],[0,-1],[-1,0],[-1,1],[0,1],[1,0]];
			for (var shift_index = 0; shift_index < shifts.length;shift_index++) {
				var shift = shifts[shift_index];
				for (var counter = 0; counter < r; counter++) {
					var distance_to_current_index = get_distance(coordinate
							,get_coordinate(current_index));
					var distance_to_nearest_found_index_in_cycle = get_distance(coordinate
														,get_coordinate(nearest_found_index_in_cycle));
					if (distance_to_current_index < distance_to_nearest_found_index_in_cycle) {
							nearest_found_index_in_cycle = current_index;							
						}
					if (index_fits_grid(grid, current_index, maximum_width)) {
						if (nearest_found_free_index) {
							var distance_to_nearest_found_free_index = get_distance(coordinate
															,get_coordinate(nearest_found_free_index));
							
							if (distance_to_current_index < distance_to_nearest_found_free_index) {
								nearest_found_free_index = current_index;
							}
						}
						else {
							nearest_found_free_index = current_index;
						}
					}
					current_index = [current_index[0] + shift[0],current_index[1] + shift[1]];
				}
			}
			if (nearest_found_free_index) {
				var distance_to_nearest_found_free_index = get_distance(coordinate
															,get_coordinate(nearest_found_free_index));
				var distance_to_nearest_found_index_in_cycle = get_distance(coordinate
														,get_coordinate(nearest_found_index_in_cycle));
				if (distance_to_nearest_found_free_index <= distance_to_nearest_found_index_in_cycle) {
					return nearest_found_free_index;																
				}
			}
			r++;
			
		}
	}
	
	function get_middle_coordinate(indexes) {
		if (indexes.length == 0) {
			return [0,0];
		}
		var accumulator = [0,0];
		for (var index_of_index = 0; index_of_index < indexes.length; index_of_index++) {
			var index = indexes[index_of_index];
			var coordinate = get_coordinate(index);
			accumulator[0]+=coordinate[0];
			accumulator[1]+=coordinate[1];			
		}
		
		var middle_coordinate = [accumulator[0]/indexes.length
		                    ,accumulator[1]/indexes.length];
		
		return middle_coordinate;
	}
	
	function get_coordinate(index) {
		var k1 = Math.sqrt(3)/2;
		var k2 = Math.sqrt(3) - 3/2;
		
		var x_offset = (-index[1]*k2 + index[0]*k1);
		var y_offset = (index[1]*k1 - index[0]*k2);
		
		return [x_offset,y_offset];
	}

	function get_index(coordinate) {
		var divisor = 3*Math.sqrt(3) - 18/4;
		
		var k1 = Math.sqrt(3)/2;
		var k2 = Math.sqrt(3) - 3/2;
		
		
		return [Math.round((k1*coordinate[0] + k2*coordinate[1])/divisor)
				,Math.round((k1*coordinate[1] + k2*coordinate[0])/divisor)];
	}

	
	function scale_vector(vector, new_length) {
		var arg = new_length/Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]);
		var sx = vector[0]*arg;
		var sy = vector[1]*arg;
		return [sx, sy];		
	}

	function calculate_vector(angle, length) {
		return [Math.cos(angle)*length,Math.sin(angle)*length];
	}
	
	
	function calculate_radius(angle, delta) {
		var length = Math.sqrt(delta[0]*delta[0] + delta[1]*delta[1]);
		switch (angle)
		{
		case 120:
			return length;
		case 150:
			return length/Math.sqrt(2 - Math.sqrt(3));
		default:
			throw "not supported angle";
		}		
	}
	
	function get_path_of_contact_icon(points) {
		var path = "M " + points[0][0] + " " + points[0][1];
		for (var point_index = 1; point_index < points.length; point_index++) {
			path += "L " + points[point_index][0] + " " + points[point_index][1];
		}
		path +=" z";
		return path;
	}
	
	function get_sum_of_vectors(vector_1,vector_2) {
		var sum = [];
		for (var index = 0; index < vector_1.length;index++) {
			sum.push(vector_1[index] + vector_2[index]);
		}
		return sum;
	}
	
	function continue_shape(points,offset) {
		var next_point = get_sum_of_vectors(points[points.length - 1],offset);
		points.push(next_point);
	}
	
	function get_lower_bound_of_shape(points) {
		var lower_bound = [points[0][0],points[0][1]];
		for (var i = 1; i < points.length; i++) {
			if (lower_bound[0] > points[i][0]) {
				lower_bound[0] = points[i][0];
			}
			if (lower_bound[1] > points[i][1]) {
				lower_bound[1] = points[i][1];
			}			
		}
		return lower_bound;
	}
	
//Function return points with coordinates shifted to the rounded lower bound and then rounded. 	
	function get_aligned_shape(points) {
		var lower_bound = get_lower_bound_of_shape(points);
		var lower_bound_of_aligned_shape = [Math.round(lower_bound[0]),Math.round(lower_bound[1])];
		var shift = [lower_bound_of_aligned_shape[0] - lower_bound[0], lower_bound_of_aligned_shape[1] - lower_bound[1]];
		var aligned_shape = [];
		for (var index = 0; index < points.length; index++) {
			var point = points[index];
			var shifted_point = [point[0] + shift[0], point[1] + shift[1]];
			var aligned_point = [Math.round(shifted_point[0]),Math.round(shifted_point[1])];
			aligned_shape.push(aligned_point);
		}
		return aligned_shape;		
	}
		
	
	function get_shape_of_object(start_point, deltas, invert_axis_of_object, expand_edge, width_of_cell) {
		var points = [start_point];
		var angle = 0;
		for (var point_index = 0; point_index < deltas.length; point_index++) {
			var previous_index = (deltas.length+point_index - 1)%deltas.length;
			var next_index = (point_index + 1)%deltas.length;
			var previous_delta = deltas[previous_index];			
			var delta = deltas[point_index];
			
			var distance_from_corner = 0;
			var previous_scaled_delta = scale_vector(previous_delta, distance_from_corner);
			var scaled_delta = scale_vector(delta, distance_from_corner);
			var index_of_x_axis = invert_axis_of_object ? 1 : 0;
			var index_of_y_axis = invert_axis_of_object ? 0 : 1;
			
			
// handling of lower left corner			
			if (expand_edge[0] && expand_edge[1] && point_index == 1) {
				var line_width = previous_delta[0] + delta[0];
				var line_height = previous_delta[1] + delta[1];
				continue_shape(points,[0,line_height]);
				continue_shape(points,[line_width,0]);
			}
			if (expand_edge[0] && expand_edge[1] && (point_index == 0 || point_index == 1)) {
				continue;
			}

			//handling of upper right corner			
			if (expand_edge[3] && expand_edge[4] && point_index == 4) {
				var line_width = previous_delta[0] + delta[0];
				var line_height = previous_delta[1] + delta[1];
				continue_shape(points,[0,line_height]);
				continue_shape(points,[line_width,0]);
			}
			if (expand_edge[3] && expand_edge[4] && (point_index == 3 || point_index == 4)) {
				continue;
			}
			
/*			
			if (!expand_edge[previous_index] || !expand_edge[point_index]) {
				var ellipse_destination = [0, 0];
				if (!expand_edge[previous_index]) {
					ellipse_destination[0] += previous_scaled_delta[index_of_x_axis];
					ellipse_destination[1] += previous_scaled_delta[index_of_y_axis];
				}
				if (!expand_edge[point_index]) {
					ellipse_destination[0] += scaled_delta[index_of_x_axis];
					ellipse_destination[1] += scaled_delta[index_of_y_axis];
				}
				var radius = calculate_radius(delta[2], ellipse_destination); 
				
				var angle = 0;

				path += " a " + radius + "," + radius
				+ " " + angle + " 0," + (invert_axis_of_object ? 0 : 1) + " "
					+ ellipse_destination[0] + "," + ellipse_destination[1];								
			}
*/			

			

			if (expand_edge[point_index]) {
				var line_width = delta[index_of_x_axis];
				var line_height = delta[index_of_y_axis];
				if (point_index == 2 || point_index ==5) {
					continue_shape(points,[line_width,0]);
					continue_shape(points,[0,line_height]);
				}
				else {
					continue_shape(points,[0,line_height]);
					continue_shape(points,[line_width,0]);
				}
			} else {							
				var line_width = delta[index_of_x_axis] - 2*scaled_delta[index_of_x_axis];
				var line_height = delta[index_of_y_axis] - 2*scaled_delta[index_of_y_axis]; 
				continue_shape(points,[line_width,line_height]);
			}

		}
		return points;
		
	}
	
	function calculate_deltas_of_hexagon(length_of_side,angle_of_rotation) {
		var deltas = [];
		for (var side_index = 0;side_index <6; side_index++) {
			var angle = ( angle_of_rotation + side_index*Math.PI/3 );
			var delta = calculate_vector(angle,length_of_side);
			delta.push(120);
			deltas.push(delta);
		}
		return deltas;
	}
	
	function get_bounds_of_cell(index) {
		var offset = 1/2;
		var coordinate = get_coordinate(index);
		return [[coordinate[0]-offset,coordinate[1]-offset]
		 	   ,[coordinate[0]+offset,coordinate[1]+offset]];		
	}
	
	function get_bounds_of_grid(grid) {
		
		var bounds = [[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY]
						,[Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY]];
		
		
		for_each_index_in_grid(grid, function(index) {
			var bounds_of_cell = get_bounds_of_cell(index);
			
			if (bounds_of_cell[0][0] < bounds[0][0]) {
				bounds[0][0] = bounds_of_cell[0][0];
			}
			if (bounds_of_cell[0][1] < bounds[0][1]) {
				bounds[0][1] = bounds_of_cell[0][1];
			}
			if (bounds_of_cell[1][0] > bounds[1][0]) {
				bounds[1][0] = bounds_of_cell[1][0];
			}
			if (bounds_of_cell[1][1] > bounds[1][1]) {
				bounds[1][1] = bounds_of_cell[1][1];
			}			
		});
		return bounds;
	}
	
    var createNode;
    var doc = window.document;
    doc.createStyleSheet().addRule(".rvml", "behavior:url(#default#VML)");
    try {
        !doc.namespaces.rvml && doc.namespaces.add("rvml", "urn:schemas-microsoft-com:vml");
        createNode = function (tagName) {
            return doc.createElement('<rvml:' + tagName + ' class="rvml">');
        };
    } catch (e) {
        createNode = function (tagName) {
            return doc.createElement('<' + tagName + ' xmlns="urn:schemas-microsoft.com:vml" class="rvml">');
        };
    }


//    fill: "none", stroke: "#000", target:"_top", path : path_string    
//    "cursor" : "pointer",
//    "stroke" : "none",
//    "title"  : contact.first_name + " " + contact.last_name,
//    "fill-size" : "37.5pt 37.5pt",
//    "href" : get_contact_url(contact.uid),
//    "target":"_top"
    var R_is = function (o, type) {
        type = String.prototype.toLowerCase.call(type);
        if (type == "finite") {
            var isnan = {"NaN": 1, "Infinity": 1, "-Infinity": 1};
            return !isnan["hasOwnProperty"](+o);
        }
        if (type == "array") {
            return o instanceof Array;
        }
        
        return  (type == "null" && o === null) ||
                (type == typeof o && o !== null) ||
                (type == "object" && o === Object(o)) ||
                (type == "array" && Array.isArray && Array.isArray(o)) ||
                Object.prototype.toString.call(o).slice(8, -1).toLowerCase() == type;
    };
    
    function repush(array, item) {
        for (var i = 0, ii = array.length; i < ii; i++) if (array[i] === item) {
            return array.push(array.splice(i, 1)[0]);
        }
    }

    function cacher(f, scope, postprocessor) {
        function newf() {
            var arg = Array.prototype.slice.call(arguments, 0),
                args = arg.join("\u2400"),
                cache = newf.cache = newf.cache || {},
                count = newf.count = newf.count || [];
            if (cache["hasOwnProperty"](args)) {
                repush(count, args);
                return postprocessor ? postprocessor(cache[args]) : cache[args];
            }
            count.length >= 1e3 && delete cache[count.shift()];
            count.push(args);
            cache[args] = f["apply"](scope, arg);
            return postprocessor ? postprocessor(cache[args]) : cache[args];
        }
        return newf;
    }
    var R__path2string = function () {
        var p2s = /,?([achlmqrstvxz]),?/gi;
        return this.join(",").replace(p2s, "$1");
    };

    
    var R_parsePathString = cacher(function (pathString) {
        if (!pathString) {
            return null;
        }
        var paramCounts = {a: 7, c: 6, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, z: 0},
            data = [];
        if (R_is(pathString, "array") && R_is(pathString[0], "array")) { // rough assumption
            data = pathClone(pathString);
        }
        if (!data.length) {
            var pathCommand = /([achlmrqstvz])[\s,]*((-?\d*\.?\d*(?:e[\-+]?\d+)?\s*,?\s*)+)/ig;
            var pathValues = /(-?\d*\.?\d*(?:e[\-+]?\d+)?)\s*,?\s*/ig;

        	String(pathString).replace(pathCommand, function (a, b, c) {
                var params = [],
                    name = b.toLowerCase();
                c.replace(pathValues, function (a, b) {
                    b && params.push(+b);
                });
                if (name == "m" && params.length > 2) {
                    data.push([b]["concat"](params.splice(0, 2)));
                    name = "l";
                    b = b == "m" ? "l" : "L";
                }
                if (name == "r") {
                    data.push([b]["concat"](params));
                } else while (params.length >= paramCounts[name]) {
                    data.push([b]["concat"](params.splice(0, paramCounts[name])));
                    if (!paramCounts[name]) {
                        break;
                    }
                }
            });
        }
        data.toString = R__path2string;
        return data;
    });
    
    var pathClone = function (pathArray) {
        var res = [];
        if (!R_is(pathArray, "array") || !R_is(pathArray && pathArray[0], "array")) { // rough assumption
            pathArray = R_parsePathString(pathArray);
        }
        for (var i = 0, ii = pathArray.length; i < ii; i++) {
            res[i] = [];
            for (var j = 0, jj = pathArray[i].length; j < jj; j++) {
                res[i][j] = pathArray[i][j];
            }
        }
        res.toString = R__path2string;
        return res;
    };
    
    
    // http://schepers.cc/getting-to-the-point
    function catmullRom2bezier(crp) {
        var d = [];
        for (var i = 0, iLen = crp.length; iLen - 2 > i; i += 2) {
            var p = [{x: +crp[i],     y: +crp[i + 1]},
                     {x: +crp[i],     y: +crp[i + 1]},
                     {x: +crp[i + 2], y: +crp[i + 3]},
                     {x: +crp[i + 4], y: +crp[i + 5]}];
            if (iLen - 4 == i) {
                p[0] = {x: +crp[i - 2], y: +crp[i - 1]};
                p[3] = p[2];
            } else if (i) {
                p[0] = {x: +crp[i - 2], y: +crp[i - 1]};
            }
            d.push(["C",
                (-p[0].x + 6 * p[1].x + p[2].x) / 6,
                (-p[0].y + 6 * p[1].y + p[2].y) / 6,
                (p[1].x + 6 * p[2].x - p[3].x) / 6,
                (p[1].y + 6*p[2].y - p[3].y) / 6,
                p[2].x,
                p[2].y
            ]);
        }

        return d;
    }

    var pathToAbsolute = cacher(function (pathArray) {
        if (!R_is(pathArray, "array") || !R_is(pathArray && pathArray[0], "array")) { // rough assumption
            pathArray = R_parsePathString(pathArray);
        }
        if (!pathArray || !pathArray.length) {
            return [["M", 0, 0]];
        }
        var res = [],
            x = 0,
            y = 0,
            mx = 0,
            my = 0,
            start = 0;
        if (pathArray[0][0] == "M") {
            x = +pathArray[0][1];
            y = +pathArray[0][2];
            mx = x;
            my = y;
            start++;
            res[0] = ["M", x, y];
        }
        for (var r, pa, i = start, ii = pathArray.length; i < ii; i++) {
            res.push(r = []);
            pa = pathArray[i];
            if (pa[0] != String.prototype.toUpperCase.call(pa[0])) {
                r[0] = String.prototype.toUpperCase.call(pa[0]);
                switch (r[0]) {
                    case "A":
                        r[1] = pa[1];
                        r[2] = pa[2];
                        r[3] = pa[3];
                        r[4] = pa[4];
                        r[5] = pa[5];
                        r[6] = +(pa[6] + x);
                        r[7] = +(pa[7] + y);
                        break;
                    case "V":
                        r[1] = +pa[1] + y;
                        break;
                    case "H":
                        r[1] = +pa[1] + x;
                        break;
                    case "R":
                        var dots = [x, y]["concat"](pa.slice(1));
                        for (var j = 2, jj = dots.length; j < jj; j++) {
                            dots[j] = +dots[j] + x;
                            dots[++j] = +dots[j] + y;
                        }
                        res.pop();
                        res = res["concat"](catmullRom2bezier(dots));
                        break;
                    case "M":
                        mx = +pa[1] + x;
                        my = +pa[2] + y;
                    default:
                        for (j = 1, jj = pa.length; j < jj; j++) {
                            r[j] = +pa[j] + ((j % 2) ? x : y);
                        }
                }
            } else if (pa[0] == "R") {
                dots = [x, y]["concat"](pa.slice(1));
                res.pop();
                res = res["concat"](catmullRom2bezier(dots));
                r = ["R"]["concat"](pa.slice(-2));
            } else {
                for (var k = 0, kk = pa.length; k < kk; k++) {
                    r[k] = pa[k];
                }
            }
            switch (r[0]) {
                case "Z":
                    x = mx;
                    y = my;
                    break;
                case "H":
                    x = r[1];
                    break;
                case "V":
                    y = r[1];
                    break;
                case "M":
                    mx = r[r.length - 2];
                    my = r[r.length - 1];
                default:
                    x = r[r.length - 2];
                    y = r[r.length - 1];
            }
        }
        res.toString = R__path2string;
        return res;
    }, null, pathClone);
    
    var l2c = function (x1, y1, x2, y2) {
        return [x1, y1, x2, y2, x2, y2];
    };
    var q2c = function (x1, y1, ax, ay, x2, y2) {
        var _13 = 1 / 3,
            _23 = 2 / 3;
        return [
                _13 * x1 + _23 * ax,
                _13 * y1 + _23 * ay,
                _13 * x2 + _23 * ax,
                _13 * y2 + _23 * ay,
                x2,
                y2
            ];
    };

    var a2c = function (x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {
        // for more information of where this math came from visit:
        // http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
        var _120 = PI * 120 / 180,
            rad = PI / 180 * (+angle || 0),
            res = [],
            xy,
            rotate = cacher(function (x, y, rad) {
                var X = x * Math.cos(rad) - y * Math.sin(rad),
                    Y = x * Math.sin(rad) + y * Math.cos(rad);
                return {x: X, y: Y};
            });
        if (!recursive) {
            xy = rotate(x1, y1, -rad);
            x1 = xy.x;
            y1 = xy.y;
            xy = rotate(x2, y2, -rad);
            x2 = xy.x;
            y2 = xy.y;
            var cos = Math.cos(PI / 180 * angle),
                sin = Math.sin(PI / 180 * angle),
                x = (x1 - x2) / 2,
                y = (y1 - y2) / 2;
            var h = (x * x) / (rx * rx) + (y * y) / (ry * ry);
            if (h > 1) {
                h = Math.sqrt(h);
                rx = h * rx;
                ry = h * ry;
            }
            var rx2 = rx * rx,
                ry2 = ry * ry,
                k = (large_arc_flag == sweep_flag ? -1 : 1) *
                    Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x))),
                cx = k * rx * y / ry + (x1 + x2) / 2,
                cy = k * -ry * x / rx + (y1 + y2) / 2,
                f1 = Math.asin(((y1 - cy) / ry).toFixed(9)),
                f2 = Math.asin(((y2 - cy) / ry).toFixed(9));

            f1 = x1 < cx ? PI - f1 : f1;
            f2 = x2 < cx ? PI - f2 : f2;
            f1 < 0 && (f1 = PI * 2 + f1);
            f2 < 0 && (f2 = PI * 2 + f2);
            if (sweep_flag && f1 > f2) {
                f1 = f1 - PI * 2;
            }
            if (!sweep_flag && f2 > f1) {
                f2 = f2 - PI * 2;
            }
        } else {
            f1 = recursive[0];
            f2 = recursive[1];
            cx = recursive[2];
            cy = recursive[3];
        }
        var df = f2 - f1;
        if (Math.abs(df) > _120) {
            var f2old = f2,
                x2old = x2,
                y2old = y2;
            f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
            x2 = cx + rx * Math.cos(f2);
            y2 = cy + ry * Math.sin(f2);
            res = a2c(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy]);
        }
        df = f2 - f1;
        var c1 = Math.cos(f1),
            s1 = Math.sin(f1),
            c2 = Math.cos(f2),
            s2 = Math.sin(f2),
            t = Math.tan(df / 4),
            hx = 4 / 3 * rx * t,
            hy = 4 / 3 * ry * t,
            m1 = [x1, y1],
            m2 = [x1 + hx * s1, y1 - hy * c1],
            m3 = [x2 + hx * s2, y2 - hy * c2],
            m4 = [x2, y2];
        m2[0] = 2 * m1[0] - m2[0];
        m2[1] = 2 * m1[1] - m2[1];
        if (recursive) {
            return [m2, m3, m4]["concat"](res);
        } else {
            res = [m2, m3, m4]["concat"](res).join()["split"](",");
            var newres = [];
            for (var i = 0, ii = res.length; i < ii; i++) {
                newres[i] = i % 2 ? rotate(res[i - 1], res[i], rad).y : rotate(res[i], res[i + 1], rad).x;
            }
            return newres;
        }
    };
    
    
    var findDotAtSegment = function (p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
        var t1 = 1 - t;
        return {
            x: Math.pow(t1, 3) * p1x + Math.pow(t1, 2) * 3 * t * c1x + t1 * 3 * t * t * c2x + Math.pow(t, 3) * p2x,
            y: Math.pow(t1, 3) * p1y + Math.pow(t1, 2) * 3 * t * c1y + t1 * 3 * t * t * c2y + Math.pow(t, 3) * p2y
        };
    };
    
    var curveDim = cacher(function (p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {
        var a = (c2x - 2 * c1x + p1x) - (p2x - 2 * c2x + c1x),
            b = 2 * (c1x - p1x) - 2 * (c2x - c1x),
            c = p1x - c1x,
            t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / 2 / a,
            t2 = (-b - Math.sqrt(b * b - 4 * a * c)) / 2 / a,
            y = [p1y, p2y],
            x = [p1x, p2x],
            dot;
        Math.abs(t1) > "1e12" && (t1 = .5);
        Math.abs(t2) > "1e12" && (t2 = .5);
        if (t1 > 0 && t1 < 1) {
            dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t1);
            x.push(dot.x);
            y.push(dot.y);
        }
        if (t2 > 0 && t2 < 1) {
            dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t2);
            x.push(dot.x);
            y.push(dot.y);
        }
        a = (c2y - 2 * c1y + p1y) - (p2y - 2 * c2y + c1y);
        b = 2 * (c1y - p1y) - 2 * (c2y - c1y);
        c = p1y - c1y;
        t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / 2 / a;
        t2 = (-b - Math.sqrt(b * b - 4 * a * c)) / 2 / a;
        Math.abs(t1) > "1e12" && (t1 = .5);
        Math.abs(t2) > "1e12" && (t2 = .5);
        if (t1 > 0 && t1 < 1) {
            dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t1);
            x.push(dot.x);
            y.push(dot.y);
        }
        if (t2 > 0 && t2 < 1) {
            dot = findDotAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t2);
            x.push(dot.x);
            y.push(dot.y);
        }
        return {
            min: {x: Math.min["apply"](0, x), y: Math.min["apply"](0, y)},
            max: {x: Math.max["apply"](0, x), y: Math.max["apply"](0, y)}
        };
    });
    var R_path2curve = cacher(function (path, path2) {
        var p = pathToAbsolute(path),
            p2 = path2 && pathToAbsolute(path2),
            attrs = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null},
            attrs2 = {x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null},
            processPath = function (path, d) {
                var nx, ny;
                if (!path) {
                    return ["C", d.x, d.y, d.x, d.y, d.x, d.y];
                }
                !(path[0] in {T:1, Q:1}) && (d.qx = d.qy = null);
                switch (path[0]) {
                    case "M":
                        d.X = path[1];
                        d.Y = path[2];
                        break;
                    case "A":
                        path = ["C"]["concat"](a2c["apply"](0, [d.x, d.y]["concat"](path.slice(1))));
                        break;
                    case "S":
                        nx = d.x + (d.x - (d.bx || d.x));
                        ny = d.y + (d.y - (d.by || d.y));
                        path = ["C", nx, ny]["concat"](path.slice(1));
                        break;
                    case "T":
                        d.qx = d.x + (d.x - (d.qx || d.x));
                        d.qy = d.y + (d.y - (d.qy || d.y));
                        path = ["C"]["concat"](q2c(d.x, d.y, d.qx, d.qy, path[1], path[2]));
                        break;
                    case "Q":
                        d.qx = path[1];
                        d.qy = path[2];
                        path = ["C"]["concat"](q2c(d.x, d.y, path[1], path[2], path[3], path[4]));
                        break;
                    case "L":
                        path = ["C"]["concat"](l2c(d.x, d.y, path[1], path[2]));
                        break;
                    case "H":
                        path = ["C"]["concat"](l2c(d.x, d.y, path[1], d.y));
                        break;
                    case "V":
                        path = ["C"]["concat"](l2c(d.x, d.y, d.x, path[1]));
                        break;
                    case "Z":
                        path = ["C"]["concat"](l2c(d.x, d.y, d.X, d.Y));
                        break;
                }
                return path;
            },
            fixArc = function (pp, i) {
                if (pp[i].length > 7) {
                    pp[i].shift();
                    var pi = pp[i];
                    while (pi.length) {
                        pp.splice(i++, 0, ["C"]["concat"](pi.splice(0, 6)));
                    }
                    pp.splice(i, 1);
                    ii = Math.max(p.length, p2 && p2.length || 0);
                }
            },
            fixM = function (path1, path2, a1, a2, i) {
                if (path1 && path2 && path1[i][0] == "M" && path2[i][0] != "M") {
                    path2.splice(i, 0, ["M", a2.x, a2.y]);
                    a1.bx = 0;
                    a1.by = 0;
                    a1.x = path1[i][1];
                    a1.y = path1[i][2];
                    ii = Math.max(p.length, p2 && p2.length || 0);
                }
            };
        for (var i = 0, ii = Math.max(p.length, p2 && p2.length || 0); i < ii; i++) {
            p[i] = processPath(p[i], attrs);
            fixArc(p, i);
            p2 && (p2[i] = processPath(p2[i], attrs2));
            p2 && fixArc(p2, i);
            fixM(p, p2, attrs, attrs2, i);
            fixM(p2, p, attrs2, attrs, i);
            var seg = p[i],
                seg2 = p2 && p2[i],
                seglen = seg.length,
                seg2len = p2 && seg2.length;
            attrs.x = seg[seglen - 2];
            attrs.y = seg[seglen - 1];
            attrs.bx = parseFloat(seg[seglen - 4]) || attrs.x;
            attrs.by = parseFloat(seg[seglen - 3]) || attrs.y;
            attrs2.bx = p2 && (parseFloat(seg2[seg2len - 4]) || attrs2.x);
            attrs2.by = p2 && (parseFloat(seg2[seg2len - 3]) || attrs2.y);
            attrs2.x = p2 && seg2[seg2len - 2];
            attrs2.y = p2 && seg2[seg2len - 1];
        }
        return p2 ? [p, p2] : p;
    }, null, pathClone);
    
    
    
    var path2vml = function (path) {
        var total =  /[ahqstv]/ig,
            command = pathToAbsolute;
        String(path).match(total) && (command = R_path2curve);
        var total = /[clmz]/g;
        if (command == pathToAbsolute && !String(path).match(total)) {
            var bites = /([clmz]),?([^clmz]*)/gi;
            var res = String(path).replace(bites, function (all, command, args) {
                var vals = [],
                    isMove = command.toLowerCase() == "m",
                    map = {M: "m", L: "l", C: "c", Z: "x", m: "t", l: "r", c: "v", z: "x"},
                    res = map[command];
                var val = /-?[^,\s-]+/g;
                args.replace(val, function (value) {
                    if (isMove && vals.length == 2) {
                        res += vals + map[command == "m" ? "l" : "L"];
                        vals = [];
                    }
                    vals.push(Math.round(value * 21600));
                });
                return res + vals;
            });
            return res;
        }
        var pa = command(path), p, r;
        res = [];
        for (var i = 0, ii = pa.length; i < ii; i++) {
            p = pa[i];
            r = pa[i][0].toLowerCase();
            r == "z" && (r = "x");
            for (var j = 1, jj = p.length; j < jj; j++) {
                r += Math.round(p[j] * 21600) + (j != jj - 1 ? "," : "");
            }
            res.push(r);
        }
        return res.join(" ");
    }    

    var R_format = function (token, params) {
        var args = R_is(params, "array") ? [0]["concat"](params) : arguments;
        var formatrg = /\{(\d+)\}/g;
        token && R_is(token, "string") && args.length - 1 && (token = token.replace(formatrg, function (str, i) {
            return args[++i] == null ? "" : args[i];
        }));
        return token || "";
    };
    var addArrow = function (o, value, isEnd) {
        var values = String(value).toLowerCase().split("-"),
            se = isEnd ? "end" : "start",
            i = values.length,
            type = "classic",
            w = "medium",
            h = "medium";
        while (i--) {
            switch (values[i]) {
                case "block":
                case "classic":
                case "oval":
                case "diamond":
                case "open":
                case "none":
                    type = values[i];
                    break;
                case "wide":
                case "narrow": h = values[i]; break;
                case "long":
                case "short": w = values[i]; break;
            }
        }
        var stroke = o.node.getElementsByTagName("stroke")[0];
        stroke[se + "arrow"] = type;
        stroke[se + "arrowlength"] = w;
        stroke[se + "arrowwidth"] = h;
    };
    
    function clrToString() {
        return this.hex;
    }

    var toHex = function (color) {
        // http://dean.edwards.name/weblog/2009/10/convert-any-colour-value-to-hex-in-msie/
        var trim = /^\s+|\s+$/g;
        var bod;
        try {
            var docum = new ActiveXObject("htmlfile");
            docum.write("<body>");
            docum.close();
            bod = docum.body;
        } catch(e) {
            alert("exception:" + e);
        }
        var range = bod.createTextRange();
        toHex = cacher(function (color) {
            try {
                bod.style.color = String(color).replace(trim, "");
                var value = range.queryCommandValue("ForeColor");
                value = ((value & 255) << 16) | (value & 65280) | ((value & 16711680) >>> 16);
                return "#" + ("000000" + value.toString(16)).slice(-6);
            } catch(e) {
                return "none";
            }
        });
        return toHex(color);
    };

    var R_rgb = cacher(function (r, g, b) {
        return "#" + (16777216 | b | (g << 8) | (r << 16)).toString(16).slice(1);
    });
    
    var rgbtoString = function () {
        return this.hex;
    };
    var packageRGB = function (r, g, b, o) {
        r *= 255;
        g *= 255;
        b *= 255;
        var rgb = {
            r: r,
            g: g,
            b: b,
            hex: R_rgb(r, g, b),
            toString: rgbtoString
        };
        R_is(o, "finite") && (rgb.opacity = o);
        return rgb;
    };
    
    
    var R_hsb2rgb = function (h, s, v, o) {
        if (this.is(h, "object") && "h" in h && "s" in h && "b" in h) {
            v = h.b;
            s = h.s;
            h = h.h;
            o = h.o;
        }
        h *= 360;
        var R, G, B, X, C;
        h = (h % 360) / 60;
        C = v * s;
        X = C * (1 - Math.abs(h % 2 - 1));
        R = G = B = v - C;

        h = ~~h;
        R += [C, X, 0, 0, X, C][h];
        G += [X, C, C, X, 0, 0][h];
        B += [0, 0, X, C, C, X][h];
        return packageRGB(R, G, B, o);
    };
    
    var R_hsl2rgb = function (h, s, l, o) {
        if (this.is(h, "object") && "h" in h && "s" in h && "l" in h) {
            l = h.l;
            s = h.s;
            h = h.h;
        }
        if (h > 1 || s > 1 || l > 1) {
            h /= 360;
            s /= 100;
            l /= 100;
        }
        h *= 360;
        var R, G, B, X, C;
        h = (h % 360) / 60;
        C = 2 * s * (l < .5 ? l : 1 - l);
        X = C * (1 - Math.abs(h % 2 - 1));
        R = G = B = l - C / 2;

        h = ~~h;
        R += [C, X, 0, 0, X, C][h];
        G += [X, C, C, X, 0, 0][h];
        B += [0, 0, X, C, C, X][h];
        return packageRGB(R, G, B, o);
    };
    
    
    
    var R_getRGB = cacher(function (colour) {
        if (!colour || !!((colour = String(colour)).indexOf("-") + 1)) {
            return {r: -1, g: -1, b: -1, hex: "none", error: 1, toString: clrToString};
        }
        if (colour == "none") {
            return {r: -1, g: -1, b: -1, hex: "none", toString: clrToString};
        }
        var hsrg = {hs: 1, rg: 1};
        !(hsrg["hasOwnProperty"](colour.toLowerCase().substring(0, 2)) || colour.charAt() == "#") && (colour = toHex(colour));
        var colourRegExp = /^\s*((#[a-f\d]{6})|(#[a-f\d]{3})|rgba?\(\s*([\d\.]+%?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?(?:\s*,\s*[\d\.]+%?)?)\s*\)|hsba?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?)%?\s*\)|hsla?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?)%?\s*\))\s*$/i;
        var res,
            red,
            green,
            blue,
            opacity,
            t,
            values,
            rgb = colour.match(colourRegExp);
        if (rgb) {
            if (rgb[2]) {
                blue = parseInt(rgb[2].substring(5), 16);
                green = parseInt(rgb[2].substring(3, 5), 16);
                red = parseInt(rgb[2].substring(1, 3), 16);
            }
            if (rgb[3]) {
                blue = parseInt((t = rgb[3].charAt(3)) + t, 16);
                green = parseInt((t = rgb[3].charAt(2)) + t, 16);
                red = parseInt((t = rgb[3].charAt(1)) + t, 16);
            }
            if (rgb[4]) {
                var commaSpaces = /\s*,\s*/;
                values = rgb[4]["split"](commaSpaces);
                red = parseFloat(values[0]);
                values[0].slice(-1) == "%" && (red *= 2.55);
                green = parseFloat(values[1]);
                values[1].slice(-1) == "%" && (green *= 2.55);
                blue = parseFloat(values[2]);
                values[2].slice(-1) == "%" && (blue *= 2.55);
                rgb[1].toLowerCase().slice(0, 4) == "rgba" && (opacity = parseFloat(values[3]));
                values[3] && values[3].slice(-1) == "%" && (opacity /= 100);
            }
            if (rgb[5]) {
                values = rgb[5]["split"](commaSpaces);
                red = parseFloat(values[0]);
                values[0].slice(-1) == "%" && (red *= 2.55);
                green = parseFloat(values[1]);
                values[1].slice(-1) == "%" && (green *= 2.55);
                blue = parseFloat(values[2]);
                values[2].slice(-1) == "%" && (blue *= 2.55);
                (values[0].slice(-3) == "deg" || values[0].slice(-1) == "\xb0") && (red /= 360);
                rgb[1].toLowerCase().slice(0, 4) == "hsba" && (opacity = parseFloat(values[3]));
                values[3] && values[3].slice(-1) == "%" && (opacity /= 100);
                return R_hsb2rgb(red, green, blue, opacity);
            }
            if (rgb[6]) {
                values = rgb[6]["split"](commaSpaces);
                red = parseFloat(values[0]);
                values[0].slice(-1) == "%" && (red *= 2.55);
                green = parseFloat(values[1]);
                values[1].slice(-1) == "%" && (green *= 2.55);
                blue = parseFloat(values[2]);
                values[2].slice(-1) == "%" && (blue *= 2.55);
                (values[0].slice(-3) == "deg" || values[0].slice(-1) == "\xb0") && (red /= 360);
                rgb[1].toLowerCase().slice(0, 4) == "hsla" && (opacity = parseFloat(values[3]));
                values[3] && values[3].slice(-1) == "%" && (opacity /= 100);
                return R_hsl2rgb(red, green, blue, opacity);
            }
            rgb = {r: red, g: green, b: blue, toString: clrToString};
            rgb.hex = "#" + (16777216 | blue | (green << 8) | (red << 16)).toString(16).slice(1);
            R_is(opacity, "finite") && (rgb.opacity = opacity);
            return rgb;
        }
        return {r: -1, g: -1, b: -1, hex: "none", error: 1, toString: clrToString};
    }, 
//TODO resolve    R);
0);    

    var preload = function (src, f) {
        var img = document.createElement("img");
        img.style.cssText = "position:absolute;left:-9999em;top-9999em";
        img.onload = function () {
            f.call(this);
            this.onload = null;
            document.body.removeChild(this);
        };
        img.onerror = function () {
            document.body.removeChild(this);
        };
        document.body.appendChild(img);
        img.src = src;
    };
    
    var R_parseDots = cacher(function (gradient) {
        var dots = [];
        for (var i = 0, ii = gradient.length; i < ii; i++) {
            var dot = {},
                par = gradient[i].match(/^([^:]*):?([\d\.]*)/);
            dot.color = R_getRGB(par[1]);
            if (dot.color.error) {
                return null;
            }
            dot.color = dot.color.hex;
            par[2] && (dot.offset = par[2] + "%");
            dots.push(dot);
        }
        for (i = 1, ii = dots.length - 1; i < ii; i++) {
            if (!dots[i].offset) {
                var start = parseFloat(dots[i - 1].offset || 0),
                    end = 0;
                for (var j = i + 1; j < ii; j++) {
                    if (dots[j].offset) {
                        end = dots[j].offset;
                        break;
                    }
                }
                if (!end) {
                    end = 100;
                    j = ii;
                }
                end = parseFloat(end);
                var d = (end - start) / (j - i + 1);
                for (; i < j; i++) {
                    start += d;
                    dots[i].offset = start + "%";
                }
            }
        }
        return dots;
    });

    var addGradientFill = function (o, gradient, fill) {
        o.attrs = o.attrs || {};
        var attrs = o.attrs,
            pow = Math.pow,
            opacity,
            oindex,
            type = "linear",
            fxfy = ".5 .5";
        o.attrs.gradient = gradient;
        var R_radial_gradient = /^r(?:\(([^,]+?)\s*,\s*([^\)]+?)\))?/,
        gradient = String(gradient).replace(R_radial_gradient, function (all, fx, fy) {
            type = "radial";
            if (fx && fy) {
                fx = parseFloat(fx);
                fy = parseFloat(fy);
                pow(fx - .5, 2) + pow(fy - .5, 2) > .25 && (fy = Math.sqrt(.25 - pow(fx - .5, 2)) * ((fy > .5) * 2 - 1) + .5);
                fxfy = fx + " " + fy;
            }
            return "";
        });
        gradient = gradient.split(/\s*\-\s*/);
        if (type == "linear") {
            var angle = gradient.shift();
            angle = -parseFloat(angle);
            if (isNaN(angle)) {
                return null;
            }
        }

        var dots = R_parseDots(gradient);
        if (!dots) {
            return null;
        }
        o = o.shape || o.node;
        if (dots.length) {
            o.removeChild(fill);
            fill.on = true;
            fill.method = "none";
            fill.color = dots[0].color;
            fill.color2 = dots[dots.length - 1].color;
            var clrs = [];
            for (var i = 0, ii = dots.length; i < ii; i++) {
                dots[i].offset && clrs.push(dots[i].offset + " " + dots[i].color);
            }
            fill.colors = clrs.length ? clrs.join() : "0% " + fill.color;
            if (type == "radial") {
                fill.type = "gradientTitle";
                fill.focus = "100%";
                fill.focussize = "0 0";
                fill.focusposition = fxfy;
                fill.angle = 0;
            } else {
                // fill.rotate= true;
                fill.type = "gradient";
                fill.angle = (270 - angle) % 360;
            }
            o.appendChild(fill);
        }
        return 1;
    };
    
    
    var setFillAndStroke = function (o, params) {
        // o.paper.canvas.style.display = "none";
        var pathTypes = {path: 1, rect: 1, image: 1};
        var ovalTypes = {circle: 1, ellipse: 1};
        o.attrs = o.attrs || {};
        var node = o.node,
            a = o.attrs,
            s = node.style,
            xy,
            newpath =  (params.x != a.x || params.y != a.y || params.width != a.width || params.height != a.height || params.cx != a.cx || params.cy != a.cy || params.rx != a.rx || params.ry != a.ry || params.r != a.r),
            isOval = false;
            var res = o;


        for (var par in params) if (params["hasOwnProperty"](par)) {
            a[par] = params[par];
        }
        if (newpath) {
            a.path = o.attr("path");
            o._.dirty = 1;
        }
        params.href && (node.href = params.href);
        params.title && (node.title = params.title);
        params.target && (node.target = params.target);
        params.cursor && (s.cursor = params.cursor);
        "blur" in params && o.blur(params.blur);
        if (params.path  || newpath) {
            node.path = path2vml(~String(a.path).toLowerCase().indexOf("r") ? pathToAbsolute(a.path) : a.path);
        }
        "transform" in params && o.transform(params.transform);
        if (isOval) {
            var cx = +a.cx,
                cy = +a.cy,
                rx = +a.rx || +a.r || 0,
                ry = +a.ry || +a.r || 0;
            node.path = R_format("ar{0},{1},{2},{3},{4},{1},{4},{1}x", Math.round((cx - rx) * zoom), Math.round((cy - ry) * zoom), Math.round((cx + rx) * zoom), Math.round((cy + ry) * zoom), Math.round(cx * zoom));
        }
        if ("clip-rect" in params) {
            var separator = /[\.\/]/;
            var rect = String(params["clip-rect"]).split(separator);
            if (rect.length == 4) {
                rect[2] = +rect[2] + (+rect[0]);
                rect[3] = +rect[3] + (+rect[1]);
                var div = node.clipRect || document.createElement("div"),
                    dstyle = div.style;
                dstyle.clip = R_format("rect({1}px {2}px {3}px {0}px)", rect);
                if (!node.clipRect) {
                    dstyle.position = "absolute";
                    dstyle.top = 0;
                    dstyle.left = 0;
                    dstyle.width = o.paper.width + "px";
                    dstyle.height = o.paper.height + "px";
                    node.parentNode.insertBefore(div, node);
                    div.appendChild(node);
                    node.clipRect = div;
                }
            }
            if (!params["clip-rect"]) {
                node.clipRect && (node.clipRect.style.clip = "");
            }
        }
        if (o.textpath) {
            var textpathStyle = o.textpath.style;
            params.font && (textpathStyle.font = params.font);
            params["font-family"] && (textpathStyle.fontFamily = '"' + params["font-family"].split(",")[0].replace(/^['"]+|['"]+$/g, "") + '"');
            params["font-size"] && (textpathStyle.fontSize = params["font-size"]);
            params["font-weight"] && (textpathStyle.fontWeight = params["font-weight"]);
            params["font-style"] && (textpathStyle.fontStyle = params["font-style"]);
        }
        if ("arrow-start" in params) {
            addArrow(res, params["arrow-start"]);
        }
        if ("arrow-end" in params) {
            addArrow(res, params["arrow-end"], 1);
        }
        if (params.opacity != null || 
            params["stroke-width"] != null ||
            params.fill != null ||
            params.src != null ||
            params.stroke != null ||
            params["stroke-width"] != null ||
            params["stroke-opacity"] != null ||
            params["fill-opacity"] != null ||
            params["stroke-dasharray"] != null ||
            params["stroke-miterlimit"] != null ||
            params["stroke-linejoin"] != null ||
            params["stroke-linecap"] != null) {
            var fill = node.getElementsByTagName("fill"),
                newfill = false;
            fill = fill && fill[0];
            !fill && (newfill = fill = createNode("fill"));
            params.fill && (fill.on = true);
            if (fill.on == null || params.fill == "none" || params.fill === null) {
                fill.on = false;
            }
            if (fill.on && params.fill) {
                var R_ISURL = /^url\(['"]?([^\)]+?)['"]?\)$/i;
            	var isURL = String(params.fill).match(R_ISURL);
                if (isURL) {
                    fill.parentNode == node && node.removeChild(fill);
                    fill.rotate = true;
                    fill.src = isURL[1];
                    fill.type = "tile";
                    fill.size = params["fill-size"];
                    var bbox = o.getBBox(1);
                    fill.position = bbox.x + " " + bbox.y;
                    o._.fillpos = [bbox.x, bbox.y];

                    preload(isURL[1], function () {
                        o._.fillsize = [this.offsetWidth, this.offsetHeight];
                    });
                } else {
                    fill.color = R_getRGB(params.fill).hex;
                    fill.src = "";
                    fill.type = "solid";
                    if (R_getRGB(params.fill).error && (res.type in {circle: 1, ellipse: 1} || String(params.fill).charAt() != "r") && addGradientFill(res, params.fill, fill)) {
                        a.fill = "none";
                        a.gradient = params.fill;
                        fill.rotate = false;
                    }
                }
            }
            if ("fill-opacity" in params || "opacity" in params) {
                var opacity = ((+a["fill-opacity"] + 1 || 2) - 1) * ((+a.opacity + 1 || 2) - 1) * ((+R_getRGB(params.fill).o + 1 || 2) - 1);
                opacity = Math.min(Math.max(opacity, 0), 1);
                fill.opacity = opacity;
                if (fill.src) {
                    fill.color = "none";
                }
            }
            node.appendChild(fill);
            var stroke = (node.getElementsByTagName("stroke") && node.getElementsByTagName("stroke")[0]),
            newstroke = false;
            !stroke && (newstroke = stroke = createNode("stroke"));
            if ((params.stroke && params.stroke != "none") ||
                params["stroke-width"] ||
                params["stroke-opacity"] != null ||
                params["stroke-dasharray"] ||
                params["stroke-miterlimit"] ||
                params["stroke-linejoin"] ||
                params["stroke-linecap"]) {
                stroke.on = true;
            }
            (params.stroke == "none" || params.stroke === null || stroke.on == null || params.stroke == 0 || params["stroke-width"] == 0) && (stroke.on = false);
            var strokeColor = R_getRGB(params.stroke);
            stroke.on && params.stroke && (stroke.color = strokeColor.hex);
            opacity = ((+a["stroke-opacity"] + 1 || 2) - 1) * ((+a.opacity + 1 || 2) - 1) * ((+strokeColor.o + 1 || 2) - 1);
            var width = (parseFloat(params["stroke-width"]) || 1) * .75;
            opacity = Math.min(Math.max(opacity, 0), 1);
            params["stroke-width"] == null && (width = a["stroke-width"]);
            params["stroke-width"] && (stroke.weight = width);
            width && width < 1 && (opacity *= width) && (stroke.weight = 1);
            stroke.opacity = opacity;
        
            params["stroke-linejoin"] && (stroke.joinstyle = params["stroke-linejoin"] || "miter");
            stroke.miterlimit = params["stroke-miterlimit"] || 8;
            params["stroke-linecap"] && (stroke.endcap = params["stroke-linecap"] == "butt" ? "flat" : params["stroke-linecap"] == "square" ? "square" : "round");
            if (params["stroke-dasharray"]) {
                var dasharray = {
                    "-": "shortdash",
                    ".": "shortdot",
                    "-.": "shortdashdot",
                    "-..": "shortdashdotdot",
                    ". ": "dot",
                    "- ": "dash",
                    "--": "longdash",
                    "- .": "dashdot",
                    "--.": "longdashdot",
                    "--..": "longdashdotdot"
                };
                stroke.dashstyle = dasharray["hasOwnProperty"](params["stroke-dasharray"]) ? dasharray[params["stroke-dasharray"]] : "";
            }
            newstroke && node.appendChild(stroke);
        }
        if (res.type == "text") {
            res.paper.canvas.style.display = "";
            var span = res.paper.span,
                m = 100,
                fontSize = a.font && a.font.match(/\d+(?:\.\d*)?(?=px)/);
            s = span.style;
            a.font && (s.font = a.font);
            a["font-family"] && (s.fontFamily = a["font-family"]);
            a["font-weight"] && (s.fontWeight = a["font-weight"]);
            a["font-style"] && (s.fontStyle = a["font-style"]);
            fontSize = parseFloat(fontSize ? fontSize[0] : a["font-size"]);
            s.fontSize = fontSize * m + "px";
            res.textpath.string && (span.innerHTML = String(res.textpath.string).replace(/</g, "&#60;").replace(/&/g, "&#38;").replace(/\n/g, "<br>"));
            var brect = span.getBoundingClientRect();
            res.W = a.w = (brect.right - brect.left) / m;
            res.H = a.h = (brect.bottom - brect.top) / m;
            // res.paper.canvas.style.display = "none";
            res.X = a.x;
            res.Y = a.y + res.H / 2;

            ("x" in params || "y" in params) && (res.path.v = R_format("m{0},{1}l{2},{1}", Math.round(a.x * zoom), Math.round(a.y * zoom), Math.round(a.x * zoom) + 1));
            var dirtyattrs = ["x", "y", "text", "font", "font-family", "font-weight", "font-style", "font-size"];
            for (var d = 0, dd = dirtyattrs.length; d < dd; d++) if (dirtyattrs[d] in params) {
                res._.dirty = 1;
                break;
            }
        
            // text-anchor emulation
            switch (a["text-anchor"]) {
                case "start":
                    res.textpath.style["v-text-align"] = "left";
                    res.bbx = res.W / 2;
                break;
                case "end":
                    res.textpath.style["v-text-align"] = "right";
                    res.bbx = -res.W / 2;
                break;
                default:
                    res.textpath.style["v-text-align"] = "center";
                    res.bbx = 0;
                break;
            }
            res.textpath.style["v-text-kern"] = true;
        }
        // res.paper.canvas.style.display = E;
    };
    
    
    var R_engine_create = function (id, width, height) {
        var container = document.getElementById(id);
            var x = 0;
            var y = 0;
        if (!container) {
            throw new Error("VML container not found.");
        }
        var res = {};
        var c = res.canvas = document.createElement("div"),
        cs = c.style;
        x = x || 0;
        y = y || 0;
        width = width || 512;
        height = height || 342;
        res.width = width;
        res.height = height;
        width == +width && (width += "px");
        height == +height && (height += "px");
        res.coordsize = zoom * 1e3 + " " + zoom * 1e3;
        res.coordorigin = "0 0";
        res.span = document.createElement("span");
        res.span.style.cssText = "position:absolute;left:-9999em;top:-9999em;padding:0;margin:0;line-height:1;";
        c.appendChild(res.span);
        cs.cssText = R_format("top:0;left:0;width:{0};height:{1};display:inline-block;position:relative;clip:rect(0 {0} {1} 0);overflow:hidden", width, height);
        if (container == 1) {

            document.body.appendChild(c);
            cs.left = x + "px";
            cs.top = y + "px";
            cs.position = "absolute";
        } else {
            if (container.firstChild) {
                container.insertBefore(c, container.firstChild);
            } else {
                container.appendChild(c);
            }
        }
        // plugins.call(res, res, R.fn);
        res.renderfix = function () {};
        return res;
    };    
    
    var RaphaelElement = function (node, vml) {
        this[0] = this.node = node;
        node.raphael = true;
        this.id = oid++;
        node.raphaelid = this.id;
        this.X = 0;
        this.Y = 0;
        this.attrs = {};
        this.paper = vml;
//        this.matrix = R.matrix();
        this._ = {
            transform: [],
            sx: 1,
            sy: 1,
            dx: 0,
            dy: 0,
            deg: 0,
            dirty: 1,
            dirtyT: 1
        };
        !vml.bottom && (vml.bottom = this);
        this.prev = vml.top;
        vml.top && (vml.top.next = this);
        vml.top = this;
        this.next = null;
    };
    var elproto = {};

    var availableAttrs = {
            "arrow-end": "none",
            "arrow-start": "none",
            blur: 0,
            "clip-rect": "0 0 1e9 1e9",
            cursor: "default",
            cx: 0,
            cy: 0,
            fill: "#fff",
            "fill-opacity": 1,
            font: '10px "Arial"',
            "font-family": '"Arial"',
            "font-size": "10",
            "font-style": "normal",
            "font-weight": 400,
            gradient: 0,
            height: 0,
            href: "http://raphaeljs.com/",
            opacity: 1,
            path: "M0,0",
            r: 0,
            rx: 0,
            ry: 0,
            src: "",
            stroke: "#000",
            "stroke-dasharray": "",
            "stroke-linecap": "butt",
            "stroke-linejoin": "butt",
            "stroke-miterlimit": 0,
            "stroke-opacity": 1,
            "stroke-width": 1,
            target: "_blank",
            "text-anchor": "middle",
            title: "Raphael",
            transform: "",
            width: 0,
            x: 0,
            y: 0
        };    
    
    RaphaelElement.prototype = elproto;
    elproto.constructor = RaphaelElement;
    var ellipsePath = function (x, y, rx, ry) {
        if (ry == null) {
            ry = rx;
        }
        return [["M", x, y], ["m", 0, -ry], ["a", rx, ry, 0, 1, 1, 0, 2 * ry], ["a", rx, ry, 0, 1, 1, 0, -2 * ry], ["z"]];
    };
    var rectPath = function (x, y, w, h, r) {
        if (r) {
            return [["M", x + r, y], ["l", w - r * 2, 0], ["a", r, r, 0, 0, 1, r, r], ["l", 0, h - r * 2], ["a", r, r, 0, 0, 1, -r, r], ["l", r * 2 - w, 0], ["a", r, r, 0, 0, 1, -r, -r], ["l", 0, r * 2 - h], ["a", r, r, 0, 0, 1, r, -r], ["z"]];
        }
        return [["M", x, y], ["l", w, 0], ["l", 0, h], ["l", -w, 0], ["z"]];
    };
    
    var getPath = {
            path: function (el) {
                return el.attr("path");
            },
            circle: function (el) {
                var a = el.attrs;
                return ellipsePath(a.cx, a.cy, a.r);
            },
            ellipse: function (el) {
                var a = el.attrs;
                return ellipsePath(a.cx, a.cy, a.rx, a.ry);
            },
            rect: function (el) {
                var a = el.attrs;
                return rectPath(a.x, a.y, a.width, a.height, a.r);
            },
            image: function (el) {
                var a = el.attrs;
                return rectPath(a.x, a.y, a.width, a.height);
            },
            text: function (el) {
                var bbox = el._getBBox();
                return rectPath(bbox.x, bbox.y, bbox.width, bbox.height);
            }
        };

    var pathDimensions = cacher(function (path) {
        if (!path) {
            return {x: 0, y: 0, width: 0, height: 0};
        }
        path = R_path2curve(path);
        var x = 0, 
            y = 0,
            X = [],
            Y = [],
            p;
        for (var i = 0, ii = path.length; i < ii; i++) {
            p = path[i];
            if (p[0] == "M") {
                x = p[1];
                y = p[2];
                X.push(x);
                Y.push(y);
            } else {
                var dim = curveDim(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);
                X = X["concat"](dim.min.x, dim.max.x);
                Y = Y["concat"](dim.min.y, dim.max.y);
                x = p[5];
                y = p[6];
            }
        }
        var xmin = Math.min["apply"](0, X),
            ymin = Math.min["apply"](0, Y);
        return {
            x: xmin,
            y: ymin,
            width: Math.max["apply"](0, X) - xmin,
            height: Math.max["apply"](0, Y) - ymin
        };
    }, null, function (o) {
        return {
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height
        };
    });
    function x_y_w_h() {
        return this.x + " " + this.y + " " + this.width + " \xd7 " + this.height;
    }
        
    var mapPath = function (path, matrix) {
        if (!matrix) {
            return path;
        }
        var x, y, i, j, pathi;
        var ii,jj;
        path = R_path2curve(path);
        for (i = 0, ii = path.length; i < ii; i++) {
            pathi = path[i];
            for (j = 1, jj = pathi.length; j < jj; j += 2) {
                x = matrix.x(pathi[j], pathi[j + 1]);
                y = matrix.y(pathi[j], pathi[j + 1]);
                pathi[j] = x;
                pathi[j + 1] = y;
            }
        }
        return path;
    };
    
    elproto.getBBox = function (isWithoutTransform) {
        if (this.removed) {
            return {};
        }
        var _ = this._;
        if (isWithoutTransform) {
            if (_.dirty || !_.bboxwt) {
                this.realPath = getPath[this.type](this);
                _.bboxwt = pathDimensions(this.realPath);
                _.bboxwt.toString = x_y_w_h;
                _.dirty = 0;
            }
            return _.bboxwt;
        }
        if (_.dirty || _.dirtyT || !_.bbox) {
            if (_.dirty || !this.realPath) {
                _.bboxwt = 0;
                this.realPath = getPath[this.type](this);
            }
            _.bbox = pathDimensions(mapPath(this.realPath, this.matrix));
            _.bbox.toString = x_y_w_h;
            _.dirty = _.dirtyT = 0;
        }
        return _.bbox;
    };
    elproto.attr = function (name, value) {
        if (this.removed) {
            return this;
        }
        if (name == null) {
            var res = {};
            for (var a in this.attrs) if (this.attrs["hasOwnProperty"](a)) {
                res[a] = this.attrs[a];
            }
            res.gradient && res.fill == "none" && (res.fill = res.gradient) && delete res.gradient;
            res.transform = this._.transform;
            return res;
        }
        if (value == null && R_is(name, "string")) {
            if (name == "fill" && this.attrs.fill == "none" && this.attrs.gradient) {
                return this.attrs.gradient;
            }
            var names = name.split(/[\.\/]/),
                out = {};
            for (var i = 0, ii = names.length; i < ii; i++) {
                name = names[i];
                if (name in this.attrs) {
                    out[name] = this.attrs[name];
                } else if (R_is(this.paper.customAttributes[name], "function")) {
                    out[name] = this.paper.customAttributes[name].def;
                } else {
                    out[name] = availableAttrs[name];
                }
            }
            return ii - 1 ? out : out[names[0]];
        }
        if (this.attrs && value == null && R_is(name, "array")) {
            out = {};
            for (i = 0, ii = name.length; i < ii; i++) {
                out[name[i]] = this.attr(name[i]);
            }
            return out;
        }
        var params;
        if (value != null) {
            params = {};
            params[name] = value;
        }
        value == null && R_is(name, "object") && (params = name);
//        for (var key in params) {
//            eve("attr." + key + "." + this.id, this, params[key]);
//        }
        if (params) {
            for (var key in this.paper.customAttributes) if (this.paper.customAttributes["hasOwnProperty"](key) && params["hasOwnProperty"](key) && R_is(this.paper.customAttributes[key], "function")) {
                var par = this.paper.customAttributes[key].apply(this, [].concat(params[key]));
                this.attrs[key] = params[key];
                for (var subkey in par) if (par["hasOwnProperty"](subkey)) {
                    params[subkey] = par[subkey];
                }
            }
            // this.paper.canvas.style.display = "none";
            if (params.text && this.type == "text") {
                this.textpath.string = params.text;
            }
            setFillAndStroke(this, params);
            // this.paper.canvas.style.display = E;
        }
        return this;
    };
    
	function create_contact_icon(paper, contact,width_of_cell,offset, expand_edge) {
		if (contact && contact.photo) {
			
			var sqrt3 = Math.sqrt(3);

			
			var deltas = calculate_deltas_of_hexagon(width_of_cell/Math.sqrt(2 + Math.sqrt(3)),Math.PI/12);
			

			
			var shape = get_shape_of_object([offset.x + deltas[3][0]
													,offset.y + deltas[3][1]], deltas, true, expand_edge, width_of_cell);
			var aligned_shape = get_aligned_shape(shape);
			var path_string = get_path_of_contact_icon(aligned_shape);

//			var image = paper.path(path_string);

			
	        var el = createNode("shape");
	        el.style.cssText = "position:absolute;left:0;top:0;width:1px;height:1px";
	        var zoom = 21600;
	        el.coordsize = zoom + " " + zoom;
	        
	        el.coordorigin = paper.coordorigin;
	        var image = new RaphaelElement(el, paper);
	        image.type = "path";
	        image.path = [];
	        image.Path = "";
	        setFillAndStroke(image, {fill: "none", stroke: "#000", target:"_top", path : path_string});
	        paper.canvas.appendChild(el);
	        var skew = createNode("skew");
	        skew.on = true;
	        el.appendChild(skew);
	        image.skew = skew;
//	        image.transform("");
			
			
			image.attr({
			    fill: "url(" + contact.photo + ")",
			    "cursor" : "pointer",
			    "stroke" : "none",
			    "title"  : contact.first_name + " " + contact.last_name,
			    "fill-size" : "37.5pt 37.5pt",
			    "href" : get_contact_url(contact.uid),
			    "target":"_top"
			});
			

			return image;
		}
		else {
			var color = window.Raphael.getColor();
//TODO			return paper.ellipse(offset.x, offset.y, 20, 15)
//				.attr({fill: color, stroke: color, "stroke-width": 2,"cursor" : "pointer"});
		}
		
	}
	
	function draw_contact_icon(paper,uid,position,width_of_cell, expand_edge) {
		
		var contact = loaded_contacts[uid];

		var icon = create_contact_icon(paper,contact,width_of_cell, position, expand_edge);
	
	}
		
	

