
$('#thread-form').on('submit', function(event){
    event.preventDefault();
    submitForm(event, $(this))
});

var submitForm = function(event, form) {
    var $form = form;
    var data = $form.data();
    var url =  $form.attr('action')
    console.log($form.attr('action'));
    $.ajax({
        url: url,
        data: data
    });
};