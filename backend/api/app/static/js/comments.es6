 function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}

const reply_link_html = `
    <a v-show="unreplied" :id="'reply-link-' + parentId" :data-comment-id="parentId" href="#" @click.prevent="createReplyForm">Reply</a>
`;

const comment_errors_html = `
    <div class="comment-errors" v-show="errors">
        <ul class="comment-error-list">
            <li v-for="error in errors">
                {{error}}
            </li>
        </ul>
    </div>
`;

const comment_text_html = `
    <ul class="children">
        <div class="comment-body">
            <a class="comment-author" :href="'/character/' + characterId">{{ characterName }}</a>
            <div class="comment-text">
                <span v-html="text"></span>
            </div>
        </div>
    </ul>
`;

const comment_form_html = `
    <div>
        <form v-show="unsubmitted" class="comment-form" action="/threads/comment/" method="post" @submit.prevent="submitForm">
            <fieldset>
                <div class="form-group">
                    <label class="col-lg-3">Replying as <b>{{ characterName }}</b></label>
                    <div class="col-lg-10">
                        <textarea :id="'comment-reply-text' + parentId" class="form-control" rows="3" name="text" v-model="text"></textarea>
                        <span class="text-success" style="display: none"></span>
                    </div>
                </div>
                <div class="form-group">
                    <div class="col-lg-10 col-lg-offset-2">
                        <button :id="'comment-reply-submit' + parentId" type="submit" class="submit-button btn btn-primary">Submit</button>
                    </div>
                </div>
            </fieldset>
        </form>
        <div :id="'comment-errors' + parentId"></div>
        <div :id="'comment-reply' + parentId"></div>
    </div>
`;

let data = {
    characterId: characterId,
    threadId: threadId,
    characterName: characterName
};

Vue.component('comment-reply-link', {
    template: reply_link_html,
    props: ['parentId'],
    data: function() {
        return {
            unreplied: true
        };
    },
    methods: {
        createReplyForm: function(event) {
            let commentId = this.parentId;
            new CommentForm({propsData: {
                parentId: commentId,
                characterId: characterId,
                characterName: characterName,
                threadId: threadId,
                unsubmitted: true
            }}).$mount('#reply-form-' + commentId);
            this.unreplied = false;
        }
    }
});

let CommentErrors = Vue.extend({
    template: comment_errors_html,
    data: function() {
        return {
            errors: []
        };
    }
});

let CommentReplyConfiguration = {
    template: comment_text_html,
    props: ['characterName', 'characterId', 'text'],
    data: function() {
        return {};
    }
};

let CommentReply = Vue.extend(CommentReplyConfiguration);
Vue.component('comment-text', CommentReplyConfiguration);

let CommentFormConfiguration = {
    template: comment_form_html,
    props: ['parentId', 'unsubmitted'],
    data: function() {
        return {
            threadId: data['threadId'],
            characterId: data['characterId'],
            characterName: data['characterName'],
            text: ""
        };
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
                    new CommentReply({propsData: {characterId: that.characterId, characterName: that.characterName, text: commentData.text}}).$mount('#comment-reply' + that.parentId);
                    that.unsubmitted = false;
                } else {
                    let errors = response.errors;
                    let errorList = [];
                    for (let field in errors) {
                        for (let error in errors[field]) {
                            errorList.push(errors[field][error]);
                        }
                    }
                    console.log(that.errors);
                    new CommentErrors({data: {errors: errorList}}).$mount('#comment-errors' + that.parentId);
                }
            });
        }
    }
};

let CommentForm = Vue.extend(CommentFormConfiguration);
Vue.component('comment-form', CommentFormConfiguration);

let vm = new Vue({
    el: '#thread'
});
