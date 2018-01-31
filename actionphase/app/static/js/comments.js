 function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}


$('#thread-form').on('submit', function(event){
    event.preventDefault();
    submitForm(event, $(this))
});

var submitForm = function(event, form) {
    var $form = form;
    var data = $form.data();
    console.log(data);
    var url =  $form.attr('action');

    var parent_id = data.parentId;
    var text = $form.find("textarea[name=text]").val();

    var csrftoken = $.cookie('csrftoken');
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        }
    });
    $.post({
        url: url,
        data: {
            'text': text,
            'parent_id': parent_id
        }
    });
};