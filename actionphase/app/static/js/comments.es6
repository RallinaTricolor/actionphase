 function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

const form_html = `
    <div>
        <form  class="comment-form" action="/threads/comment/" method="post" @submit.prevent="submitForm">
            <fieldset>
                <div class="form-group">
                    <label class="col-lg-3">Replying as <b>{{ characterName }}</b></label>
                    <div class="col-lg-10">
                        <textarea class="form-control" rows="3" name="text" v-model="text"></textarea>
                        <span class="text-success" style="display: none"></span>
                    </div>
                </div>
                <div class="form-group">
                    <div class="col-lg-10 col-lg-offset-2">
                        <button type="submit" class="submit-button btn btn-primary">Submit</button>
                    </div>
                </div>
            </fieldset>
        </form>
        <div class="comment-errors" v-show="errors">
            <ul class="comment-error-list">
                <li v-for="error in errors">
                    {{error}}
                </li>
            </ul>
        </div>
        <div class="comment-body" v-show="replied">
            <a class="comment-author" :href="'/character/' + characterId">{{ characterName }}</a>
            <div class="comment-text">
                {{ replyText }}
            </div>
        </div>
    </div>
`;

let data = {
    text: 'Enter a comment...',
    replied: false,
    errors: false,
    replyText: null
};

Vue.component('comment-form', {
    template: form_html,
    props: ['threadId', 'characterName', 'characterId', 'parentId'],
    data: function() {
        return data;
    },
    methods: {
        submitForm: function(event) {
            let that = this;
            let url =  event.target.action;
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
                    'text': this.text,
                    'parent': this.parentId,
                    'thread': this.threadId,
                    'author': this.characterId
                }
            }).done(function(response) {
                if (response.success) {
                    let comments = JSON.parse(response.data);
                    let comment = comments[0];
                    let commentData = comment.fields;
                    that.replied = true;
                    that.replyText = commentData.text;
                } else {
                    let errors = response.errors;
                    that.errors = [];
                    for (let field in errors) {
                        console.log(errors);
                        for (let error in errors[field]) {
                            that.errors.push(errors[field][error]);
                        }
                    }
                }
            });
        }
    }
});

let vm = new Vue({
    el: '#thread-form'
});