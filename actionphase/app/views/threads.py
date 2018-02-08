from django.forms import ModelForm
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.core import serializers

from actionphase.app.models import Game, Thread, Comment, Character


class ThreadForm(ModelForm):
    class Meta:
        model = Thread
        exclude = ['author', 'game']


class CommentForm(ModelForm):
    class Meta:
        model = Comment
        fields = ['text', 'parent', 'author', 'thread']
        error_messages = {
            'text': {
                'required': 'Please put some text in your comment!'
            },
            'author': {
                'required': 'A character is required to reply to this thread!'
            }
        }


def thread_create(request, game_id, template_name='threads/form.html'):
    game = get_object_or_404(Game, pk=game_id)
    game.can_edit_or_403(request.user)
    form = ThreadForm(request.POST or None)
    if form.is_valid():
        thread = form.save(commit=False)
        thread.author = request.user
        thread.game = game
        thread.save()
        return redirect('game_view', game_id)
    return render(request, template_name, {'form': form})


def thread_view(request, pk, comment_id = None, template_name='threads/view.html'):
    thread = get_object_or_404(Thread, pk=pk)
    if comment_id is None:
        comments = Comment.objects.filter(thread=thread)
    else:
        parent = Comment.objects.get(pk=comment_id)
        comments = parent.get_descendants(include_self=True)
    character = Character.objects.filter(owner=request.user, game=thread.game).first()
    return render(request, template_name, {'thread': thread, 'comments': comments, 'character': character})


def thread_update(request, pk, template_name='threads/form.html'):
    thread = get_object_or_404(Thread, pk=pk)
    game = get_object_or_404(Game, pk=thread.game.id)
    game.can_edit_or_403(request.user)
    form = ThreadForm(request.POST or None, instance=thread)
    if form.is_valid():
        thread = form.save(commit=False)
        thread.author = request.user
        thread.game = game
        thread.save()
        return redirect('thread_view', thread.id)
    return render(request, template_name, {'form': form})


def thread_delete(request, pk, template_name='threads/confirm_delete.html'):
    thread = get_object_or_404(Thread, pk=pk)
    game = get_object_or_404(Game, pk=thread.game.id)
    game.can_edit_or_403(request.user)
    if request.method == 'POST':
        thread.delete()
        return redirect('game_view', game.id)
    return render(request, template_name, {'object': thread})


def thread_comment(request):
    form = CommentForm(request.POST or None)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.save()
        response_data = {
            "success": True,
            "data": serializers.serialize('json', [comment, ])
        }
    else:
        response_data = {
            "success": False,
            "errors": form.errors
        }
    if request.is_ajax():
        return JsonResponse(response_data)
    else:
        return redirect('thread_view', form.threadId)
