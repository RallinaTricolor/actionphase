from django.forms import ModelForm, ValidationError
from django.shortcuts import render, redirect, get_object_or_404
from django.core.files.images import get_image_dimensions

from api.app.models import Character


class CharacterForm(ModelForm):
    VALID_IMAGE_WIDTH = 100
    VALID_IMAGE_HEIGHT = 100

    class Meta:
        model = Character
        exclude = ['owner', 'game', 'status', 'image_version']

    def clean_image(self):
        # Validate image dimensions
        image = self.cleaned_data['image']
        if image:
            width, height = get_image_dimensions(image)
            if width != self.VALID_IMAGE_WIDTH or height != self.VALID_IMAGE_HEIGHT:
                raise ValidationError('Image must be %spx by %spx' % (self.VALID_IMAGE_WIDTH, self.VALID_IMAGE_HEIGHT))
        return image


def character_view(request, pk, template_name='characters/view.html'):
    character = get_object_or_404(Character, pk=pk)
    permission_level = character.get_permission_level(request.user)
    return render(request, template_name, {'character': character, 'permission_level': permission_level})


def character_update(request, pk, template_name='characters/form.html'):
    character = get_object_or_404(Character, pk=pk)
    character.can_edit_or_403(request.user)
    form = CharacterForm(request.POST or None, request.FILES or None, instance=character)
    if form.is_valid():
        form.save()
        return redirect('character_view', pk=pk)
    return render(request, template_name, {'form': form})


def character_review(request, pk):
    character = get_object_or_404(Character, pk=pk)
    character.can_edit_or_403(request.user)
    if character.can_submit_for_review():
        character.status = Character.REVIEW
        character.save()
    return redirect('character_view', pk=pk)


def character_approve(request, pk):
    character = get_object_or_404(Character, pk=pk)
    if request.user == character.game.game_master and character.can_approve():
        character.status = Character.FINISHED
        character.save()
    return redirect('character_view', pk=pk)


def character_reject(request, pk):
    character = get_object_or_404(Character, pk=pk)
    if request.user == character.game.game_master and character.can_approve():
        character.status = Character.PROGRESS
        character.save()
    return redirect('character_view', pk=pk)
