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

const comment_reply_html = `
    <ul class="children">
        <div class="comment-body" v-show="replied">
            <a class="comment-author" :href="'/character/' + characterId">{{ characterName }}</a>
            <div class="comment-text">
                {{ replyText }}
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
        <div :id="'comment-errors' + parentId"></div>
        <div :id="'comment-reply' + parentId"></div>
    </div>
`;

let data = {
    replied: false,
    errors: false,
    replyText: null,
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
            errors: data['errors']
        };
    }
});

let CommentReply = Vue.extend({
    template: comment_reply_html,
    props: ['characterName', 'characterId'],
    data: function() {
        return {
            replied: data['replied'],
            replyText: data['replyText']
        };
    }
});

let CommentFormConfiguration = {
    template: comment_form_html,
    props: ['text', 'parentId', 'unsubmitted'],
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
                    new CommentReply({propsData: {characterId: that.characterId, characterName: that.characterName}}).$mount('#comment-reply' + that.parentId);
                    that.unsubmitted = false;
                } else {
                    let errors = response.errors;
                    that.errors = [];
                    for (let field in errors) {
                        for (let error in errors[field]) {
                            that.errors.push(errors[field][error]);
                        }
                    }
                    new CommentErrors().$mount('#comment-errors' + that.parentId);
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
