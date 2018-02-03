 function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}


$('#thread-form').on('submit', function(event){
    event.preventDefault();
    submitForm(event, $(this))
});

function submitForm(event, form) {
    let $form = form;
    let data = $form.data();
    let url =  $form.attr('action');

    let parent_id = data.parentId;
    let text = $form.find("textarea[name=text]").val();

    let csrftoken = $.cookie('csrftoken');
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