from django.http import HttpResponse


def index(request):
    name = request.user.email if request.user.is_authenticated else 'world'
    return HttpResponse("Hello, " + name + ". You're at the Action Phase index.")
